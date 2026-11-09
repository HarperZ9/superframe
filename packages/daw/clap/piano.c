// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
//
// superframe piano: the DAW's stiff waveguide string (daw/dispersion.py stiff_string) as a CLAP instrument.
//
// Each key's loop comes from clap/piano_table.h, written by daw/clap_tables.py from the offline code: integer
// delay n, tuning allpass t, loop gain g, and m first-order dispersion allpasses with coefficient a, sized from
// the inharmonicity measured on a Steinway model B (dispersion.piano_b). The loop filter runs as second-order
// sections in the order scipy's sosfilt uses (x_new = b0 x + z0; z0 = b1 x - a1 x_new + z1; z1 = b2 x - a2 x_new),
// one sample at a time, so the output equals dispersion.stiff_string bit for bit (tests/test_clap.py). Velocity
// scales the hammer force. Note-off is ignored: the string rings out at its T60, as the offline note does.
//
// This kernel is C for now; the BuildLang port is the next step for it (DESIGN.md section 5).
#include <stdlib.h>
#include <string.h>

#include <clap/clap.h>

#include "piano_table.h"

#define PIANO_VOICES 16
#define PIANO_RING 2048
#define PIANO_SECTIONS 18
#define PIANO_GAIN 0.25

typedef struct {
    int active, n, sections, hlen;
    long long k;                         // samples since the strike
    double vel;
    double sos[PIANO_SECTIONS][6];
    double zi[PIANO_SECTIONS][2];
    double ring[PIANO_RING];
    const double *hammer;
} string_t;

typedef struct {
    clap_plugin_t plugin;
    const piano_row_t *rows;
    const double *hammer;
    int hlen;
    uint32_t next_voice;
    string_t *v;
} piano_t;

static const char *const piano_features[] = {CLAP_PLUGIN_FEATURE_INSTRUMENT, CLAP_PLUGIN_FEATURE_SYNTHESIZER,
                                             CLAP_PLUGIN_FEATURE_STEREO, NULL};

const clap_plugin_descriptor_t piano_desc = {
    .clap_version = CLAP_VERSION_INIT,
    .id = "io.github.harperz9.superframe.piano",
    .name = "superframe piano",
    .vendor = "Zain Dana Harper",
    .url = "https://github.com/HarperZ9/superframe",
    .manual_url = "https://github.com/HarperZ9/superframe/tree/main/packages/daw",
    .support_url = "https://github.com/HarperZ9/superframe/issues",
    .version = "0.1.0",
    .description = "Stiff piano strings with inharmonicity measured on a Steinway model B; output equals the offline render",
    .features = piano_features,
};

static void strike(piano_t *s, int key, double vel) {
    if (key < PIANO_KEY0 || key >= PIANO_KEY0 + PIANO_KEYS) return;
    const piano_row_t *r = &s->rows[key - PIANO_KEY0];
    string_t *v = &s->v[s->next_voice];
    s->next_voice = (s->next_voice + 1) % PIANO_VOICES;
    memset(v, 0, sizeof(*v));
    v->active = 1; v->n = r->n; v->vel = vel; v->hammer = s->hammer; v->hlen = s->hlen;
    v->sections = 2 + r->m;
    double sos0[6] = {r->g * r->t, r->g, 0.0, 1.0, r->t, 0.0};
    double sos1[6] = {0.5, 0.5, 0.0, 1.0, 0.0, 0.0};
    memcpy(v->sos[0], sos0, sizeof sos0);
    memcpy(v->sos[1], sos1, sizeof sos1);
    for (int j = 0; j < r->m; ++j) {
        double sa[6] = {r->a, 1.0, 0.0, 1.0, r->a, 0.0};
        memcpy(v->sos[2 + j], sa, sizeof sa);
    }
}

static double string_tick(string_t *v) {
    long long k = v->k++;
    int slot = (int)(k % v->n);
    double x = k >= v->n ? v->ring[slot] : 0.0;           // v[k - n], the loop's input
    for (int j = 0; j < v->sections; ++j) {
        const double *c = v->sos[j];
        double *z = v->zi[j];
        double y = c[0] * x + z[0];
        z[0] = c[1] * x - c[4] * y + z[1];
        z[1] = c[2] * x - c[5] * y;
        x = y;
    }
    double e = k < v->hlen ? v->hammer[k] * v->vel : 0.0;
    double out = e + x;
    v->ring[slot] = out;
    return out;
}

static bool p_init(const clap_plugin_t *p) { (void)p; return true; }
static void p_destroy(const clap_plugin_t *p) { piano_t *s = p->plugin_data; free(s->v); free(s); }

static bool p_activate(const clap_plugin_t *p, double fs, uint32_t lo, uint32_t hi) {
    (void)lo; (void)hi;
    piano_t *s = p->plugin_data;
    if (fs == 48000.0) { s->rows = piano_rows_48000; s->hammer = piano_hammer_48000;
                         s->hlen = (int)(sizeof piano_hammer_48000 / sizeof(double)); }
    else if (fs == 44100.0) { s->rows = piano_rows_44100; s->hammer = piano_hammer_44100;
                              s->hlen = (int)(sizeof piano_hammer_44100 / sizeof(double)); }
    else return false;                                    // tables exist for 44.1 and 48 kHz only
    free(s->v);
    s->v = calloc(PIANO_VOICES, sizeof(string_t));
    s->next_voice = 0;
    return s->v != NULL;
}

static void p_deactivate(const clap_plugin_t *p) { piano_t *s = p->plugin_data; free(s->v); s->v = NULL; }
static bool p_start(const clap_plugin_t *p) { (void)p; return true; }
static void p_stop(const clap_plugin_t *p) { (void)p; }
static void p_reset(const clap_plugin_t *p) {
    piano_t *s = p->plugin_data;
    if (s->v) memset(s->v, 0, PIANO_VOICES * sizeof(string_t));
}

static void p_run(piano_t *s, const clap_process_t *pr, uint32_t from, uint32_t to) {
    for (uint32_t i = from; i < to; ++i) {
        double acc = 0.0;
        for (int j = 0; j < PIANO_VOICES; ++j)
            if (s->v[j].active) acc += string_tick(&s->v[j]);
        float o = (float)(PIANO_GAIN * acc);
        for (uint32_t c = 0; c < pr->audio_outputs[0].channel_count; ++c) pr->audio_outputs[0].data32[c][i] = o;
    }
}

static clap_process_status p_process(const clap_plugin_t *p, const clap_process_t *pr) {
    piano_t *s = p->plugin_data;
    uint32_t n = pr->frames_count, at = 0;
    uint32_t count = pr->in_events ? pr->in_events->size(pr->in_events) : 0;
    if (pr->audio_outputs_count < 1 || !s->v) return CLAP_PROCESS_ERROR;
    for (uint32_t i = 0; i < count; ++i) {
        const clap_event_header_t *h = pr->in_events->get(pr->in_events, i);
        if (h->space_id != CLAP_CORE_EVENT_SPACE_ID) continue;
        uint32_t t = h->time < n ? h->time : n;
        if (h->type == CLAP_EVENT_NOTE_ON) {
            const clap_event_note_t *e = (const clap_event_note_t *)h;
            p_run(s, pr, at, t); at = t;
            strike(s, e->key, e->velocity);
        } else if (h->type == CLAP_EVENT_MIDI) {
            const clap_event_midi_t *e = (const clap_event_midi_t *)h;
            if ((e->data[0] & 0xF0) == 0x90 && e->data[2] > 0) {
                p_run(s, pr, at, t); at = t;
                strike(s, e->data[1], e->data[2] / 127.0);
            }
        }
    }
    p_run(s, pr, at, n);
    return CLAP_PROCESS_CONTINUE;
}

// The audio ports, note ports and latency extensions are the same as the bars instrument's (bars.c).
extern const void *superframe_shared_extension(const char *id);

static const void *p_extension(const clap_plugin_t *p, const char *id) { (void)p; return superframe_shared_extension(id); }
static void p_main_thread(const clap_plugin_t *p) { (void)p; }

const clap_plugin_t *piano_create(const clap_host_t *host) {
    (void)host;
    piano_t *s = calloc(1, sizeof(piano_t));
    if (!s) return NULL;
    s->plugin.desc = &piano_desc;
    s->plugin.plugin_data = s;
    s->plugin.init = p_init;
    s->plugin.destroy = p_destroy;
    s->plugin.activate = p_activate;
    s->plugin.deactivate = p_deactivate;
    s->plugin.start_processing = p_start;
    s->plugin.stop_processing = p_stop;
    s->plugin.reset = p_reset;
    s->plugin.process = p_process;
    s->plugin.get_extension = p_extension;
    s->plugin.on_main_thread = p_main_thread;
    return &s->plugin;
}
