// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
//
// A minimal CLAP host for tests: load a plugin, check its descriptor and extensions, play a list of notes in
// blocks of a given size, and write the stereo output as raw float32 (interleaved). Timing of the process
// calls is printed with the descriptor as one JSON line on stdout.
//
//   host_check PLUGIN[#INDEX] OUT.f32 BLOCK SECONDS FS [t:key:vel[:midi]] ...
//
// t is the absolute sample of the note; the host places it in the right block at the right offset.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include <clap/clap.h>

#ifdef _WIN32
#include <windows.h>
static void *open_lib(const char *p) { return (void *)LoadLibraryA(p); }
static void *find_sym(void *h, const char *n) { return (void *)GetProcAddress((HMODULE)h, n); }
static double now_s(void) {
    LARGE_INTEGER f, c;
    QueryPerformanceFrequency(&f); QueryPerformanceCounter(&c);
    return (double)c.QuadPart / (double)f.QuadPart;
}
#else
#include <dlfcn.h>
static void *open_lib(const char *p) { return dlopen(p, RTLD_NOW | RTLD_LOCAL); }
static void *find_sym(void *h, const char *n) { return dlsym(h, n); }
static double now_s(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (double)t.tv_sec + 1e-9 * (double)t.tv_nsec;
}
#endif

#define MAX_EVENTS 256

typedef struct { uint32_t at; int key; double vel; int midi; } note_t;
typedef struct { clap_event_note_t note[MAX_EVENTS]; clap_event_midi_t midi[MAX_EVENTS]; const clap_event_header_t *h[MAX_EVENTS]; uint32_t n; } list_t;

static uint32_t ev_size(const clap_input_events_t *l) { return ((const list_t *)l->ctx)->n; }
static const clap_event_header_t *ev_get(const clap_input_events_t *l, uint32_t i) { return ((const list_t *)l->ctx)->h[i]; }
static bool ev_push(const clap_output_events_t *l, const clap_event_header_t *e) { (void)l; (void)e; return true; }

static const void *host_ext(const clap_host_t *h, const char *id) { (void)h; (void)id; return NULL; }
static void host_nop(const clap_host_t *h) { (void)h; }

static int fail(const char *why) { fprintf(stderr, "host_check: %s\n", why); return 2; }

int main(int argc, char **argv) {
    if (argc < 6) return fail("usage: host_check PLUGIN OUT BLOCK SECONDS FS [t:key:vel[:midi]] ...");
    uint32_t block = (uint32_t)atoi(argv[3]);
    double fs = atof(argv[5]);
    uint32_t total = (uint32_t)(atof(argv[4]) * fs);
    note_t notes[MAX_EVENTS];
    int nn = 0;
    for (int i = 6; i < argc && nn < MAX_EVENTS; ++i, ++nn) {
        notes[nn].midi = 0;
        if (sscanf(argv[i], "%u:%d:%lf:%d", &notes[nn].at, &notes[nn].key, &notes[nn].vel, &notes[nn].midi) < 3)
            return fail("bad note");
    }
    char path[4096];
    unsigned index = 0;
    strncpy(path, argv[1], sizeof path - 1); path[sizeof path - 1] = 0;
    char *hash = strrchr(path, '#');
    if (hash) { index = (unsigned)atoi(hash + 1); *hash = 0; }
    void *lib = open_lib(path);
    if (!lib) return fail("cannot load plugin");
    const clap_plugin_entry_t *entry = (const clap_plugin_entry_t *)find_sym(lib, "clap_entry");
    if (!entry || !clap_version_is_compatible(entry->clap_version)) return fail("no compatible clap_entry");
    if (!entry->init(path)) return fail("entry init failed");
    const clap_plugin_factory_t *fac = (const clap_plugin_factory_t *)entry->get_factory(CLAP_PLUGIN_FACTORY_ID);
    if (!fac || fac->get_plugin_count(fac) <= index) return fail("no factory or no such plugin");
    const clap_plugin_descriptor_t *d = fac->get_plugin_descriptor(fac, index);
    clap_host_t host = {CLAP_VERSION_INIT, NULL, "host_check", "superframe", "", "0.1.0",
                        host_ext, host_nop, host_nop, host_nop};
    const clap_plugin_t *pl = fac->create_plugin(fac, &host, d->id);
    if (!pl || !pl->init(pl)) return fail("create or init failed");
    const clap_plugin_audio_ports_t *ap = pl->get_extension(pl, CLAP_EXT_AUDIO_PORTS);
    const clap_plugin_note_ports_t *np = pl->get_extension(pl, CLAP_EXT_NOTE_PORTS);
    const clap_plugin_latency_t *lat = pl->get_extension(pl, CLAP_EXT_LATENCY);
    if (!ap || !np) return fail("audio or note ports missing");
    clap_audio_port_info_t api;
    if (ap->count(pl, false) != 1 || !ap->get(pl, 0, false, &api) || api.channel_count != 2) return fail("not one stereo output");
    if (!pl->activate(pl, fs, 1, block) || !pl->start_processing(pl)) return fail("activate failed");
    int latency = lat ? (int)lat->get(pl) : -1;
    int instrument = 0;
    for (const char *const *f = d->features; f && *f; ++f) instrument |= !strcmp(*f, CLAP_PLUGIN_FEATURE_INSTRUMENT);

    float *l = calloc(block, sizeof(float)), *r = calloc(block, sizeof(float));
    float *all = calloc((size_t)total * 2, sizeof(float));
    static list_t list;
    clap_input_events_t in = {&list, ev_size, ev_get};
    clap_output_events_t out_ev = {NULL, ev_push};
    float *chans[2] = {l, r};
    clap_audio_buffer_t outbuf = {chans, NULL, 2, 0, 0};
    double busy = 0.0;
    for (uint32_t start = 0; start < total; start += block) {
        uint32_t n = total - start < block ? total - start : block;
        list.n = 0;
        for (int i = 0; i < nn; ++i) {
            if (notes[i].at < start || notes[i].at >= start + n) continue;
            uint32_t k = list.n++;
            if (notes[i].midi) {
                clap_event_midi_t *e = &list.midi[k];
                e->header = (clap_event_header_t){sizeof(*e), notes[i].at - start, CLAP_CORE_EVENT_SPACE_ID, CLAP_EVENT_MIDI, 0};
                e->port_index = 0;
                e->data[0] = 0x90; e->data[1] = (uint8_t)notes[i].key; e->data[2] = (uint8_t)(notes[i].vel * 127.0 + 0.5);
                list.h[k] = &e->header;
            } else {
                clap_event_note_t *e = &list.note[k];
                e->header = (clap_event_header_t){sizeof(*e), notes[i].at - start, CLAP_CORE_EVENT_SPACE_ID, CLAP_EVENT_NOTE_ON, 0};
                e->note_id = -1; e->port_index = 0; e->channel = 0; e->key = (int16_t)notes[i].key; e->velocity = notes[i].vel;
                list.h[k] = &e->header;
            }
        }
        clap_process_t pr = {0};
        pr.steady_time = start; pr.frames_count = n; pr.audio_outputs = &outbuf; pr.audio_outputs_count = 1;
        pr.in_events = &in; pr.out_events = &out_ev;
        double t0 = now_s();
        if (pl->process(pl, &pr) == CLAP_PROCESS_ERROR) return fail("process error");
        busy += now_s() - t0;
        for (uint32_t i = 0; i < n; ++i) { all[2 * (start + i)] = l[i]; all[2 * (start + i) + 1] = r[i]; }
    }
    pl->stop_processing(pl);
    pl->deactivate(pl);
    pl->destroy(pl);
    entry->deinit();
    FILE *f = fopen(argv[2], "wb");
    if (!f || fwrite(all, sizeof(float), (size_t)total * 2, f) != (size_t)total * 2) return fail("cannot write output");
    fclose(f);
    printf("{\"id\": \"%s\", \"instrument\": %d, \"latency\": %d, \"frames\": %u, \"process_s\": %.9f}\n",
           d->id, instrument, latency, total, busy);
    return 0;
}
