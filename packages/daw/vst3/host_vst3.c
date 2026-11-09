// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
//
// A minimal VST3 host for tests: load a module, create class INDEX as a component, set it up for 32-bit stereo
// at FS, play note events in blocks of BLOCK frames, and write the stereo output as raw float32 (interleaved).
// The class name, latency and process time print as one JSON line on stdout.
//
//   host_vst3 MODULE[#INDEX] OUT.f32 BLOCK SECONDS FS [t:key:vel[:midi[:kind]]] ...
//
// Same arguments as clap/host_check.c; kind 0 is a note-on and 1 a note-off (VST3 has no program change event).
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "vst3_c_api.h"

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
typedef struct { uint32_t at; int key; double vel; int midi, kind; } note_t;
typedef struct { const Steinberg_Vst_IEventListVtbl *lpVtbl; struct Steinberg_Vst_Event e[MAX_EVENTS]; int n; } list_t;

static Steinberg_tresult SMTG_STDMETHODCALLTYPE l_query(void *p, const Steinberg_TUID iid, void **o) { (void)p; (void)iid; *o = NULL; return Steinberg_kNoInterface; }
static Steinberg_uint32 SMTG_STDMETHODCALLTYPE l_ref(void *p) { (void)p; return 1; }
static Steinberg_int32 SMTG_STDMETHODCALLTYPE l_count(void *p) { return ((list_t *)p)->n; }
static Steinberg_tresult SMTG_STDMETHODCALLTYPE l_get(void *p, Steinberg_int32 i, struct Steinberg_Vst_Event *e) {
    list_t *l = p;
    if (i < 0 || i >= l->n) return Steinberg_kInvalidArgument;
    *e = l->e[i];
    return Steinberg_kResultOk;
}
static Steinberg_tresult SMTG_STDMETHODCALLTYPE l_add(void *p, struct Steinberg_Vst_Event *e) { (void)p; (void)e; return Steinberg_kResultFalse; }
static const Steinberg_Vst_IEventListVtbl list_vtbl = {l_query, l_ref, l_ref, l_count, l_get, l_add};

static int fail(const char *why) { fprintf(stderr, "host_vst3: %s\n", why); return 2; }

typedef void *(SMTG_STDMETHODCALLTYPE *get_factory_t)(void);

int main(int argc, char **argv) {
    if (argc < 6) return fail("usage: host_vst3 MODULE[#INDEX] OUT BLOCK SECONDS FS [t:key:vel[:midi[:kind]]] ...");
    int32_t block = atoi(argv[3]);
    double fs = atof(argv[5]);
    uint32_t total = (uint32_t)(atof(argv[4]) * fs);
    note_t notes[MAX_EVENTS];
    int nn = 0;
    for (int i = 6; i < argc && nn < MAX_EVENTS; ++i, ++nn) {
        notes[nn].midi = 0; notes[nn].kind = 0;
        if (sscanf(argv[i], "%u:%d:%lf:%d:%d", &notes[nn].at, &notes[nn].key, &notes[nn].vel, &notes[nn].midi, &notes[nn].kind) < 3)
            return fail("bad note");
    }
    char path[4096];
    int index = 0;
    strncpy(path, argv[1], sizeof path - 1); path[sizeof path - 1] = 0;
    char *hash = strrchr(path, '#');
    if (hash) { index = atoi(hash + 1); *hash = 0; }
    void *lib = open_lib(path);
    if (!lib) return fail("cannot load module");
    bool (*entry)(void *) = (bool (*)(void *))find_sym(lib, "ModuleEntry");
    if (entry && !entry(lib)) return fail("ModuleEntry failed");
    get_factory_t get = (get_factory_t)find_sym(lib, "GetPluginFactory");
    if (!get) return fail("no GetPluginFactory");
    struct Steinberg_IPluginFactory *fac = get();
    if (!fac || fac->lpVtbl->countClasses(fac) <= index) return fail("no factory or no such class");
    struct Steinberg_PClassInfo info;
    if (fac->lpVtbl->getClassInfo(fac, index, &info) != Steinberg_kResultOk) return fail("no class info");
    if (strcmp(info.category, "Audio Module Class")) return fail("not an audio module");
    struct Steinberg_Vst_IComponent *comp = NULL;
    if (fac->lpVtbl->createInstance(fac, info.cid, Steinberg_Vst_IComponent_iid, (void **)&comp) != Steinberg_kResultOk || !comp)
        return fail("createInstance failed");
    if (comp->lpVtbl->initialize(comp, NULL) != Steinberg_kResultOk) return fail("initialize failed");
    struct Steinberg_Vst_IAudioProcessor *proc = NULL;
    if (comp->lpVtbl->queryInterface(comp, Steinberg_Vst_IAudioProcessor_iid, (void **)&proc) != Steinberg_kResultOk)
        return fail("no IAudioProcessor");
    if (comp->lpVtbl->getBusCount(comp, Steinberg_Vst_MediaTypes_kAudio, Steinberg_Vst_BusDirections_kOutput) != 1 ||
        comp->lpVtbl->getBusCount(comp, Steinberg_Vst_MediaTypes_kEvent, Steinberg_Vst_BusDirections_kInput) != 1)
        return fail("not one audio output and one event input");
    Steinberg_Vst_SpeakerArrangement stereo = Steinberg_Vst_SpeakerArr_kStereo;
    if (proc->lpVtbl->setBusArrangements(proc, NULL, 0, &stereo, 1) != Steinberg_kResultOk) return fail("stereo refused");
    struct Steinberg_Vst_ProcessSetup su = {Steinberg_Vst_ProcessModes_kRealtime, Steinberg_Vst_SymbolicSampleSizes_kSample32, block, fs};
    if (proc->lpVtbl->setupProcessing(proc, &su) != Steinberg_kResultOk) return fail("setupProcessing failed");
    comp->lpVtbl->activateBus(comp, Steinberg_Vst_MediaTypes_kAudio, Steinberg_Vst_BusDirections_kOutput, 0, 1);
    comp->lpVtbl->activateBus(comp, Steinberg_Vst_MediaTypes_kEvent, Steinberg_Vst_BusDirections_kInput, 0, 1);
    if (comp->lpVtbl->setActive(comp, 1) != Steinberg_kResultOk) return fail("setActive failed");
    if (proc->lpVtbl->setProcessing(proc, 1) != Steinberg_kResultOk) return fail("setProcessing failed");
    int latency = (int)proc->lpVtbl->getLatencySamples(proc);

    float *l = calloc((size_t)block, sizeof(float)), *r = calloc((size_t)block, sizeof(float));
    float *all = calloc((size_t)total * 2, sizeof(float));
    float *chans[2] = {l, r};
    static list_t list = {&list_vtbl, {{0}}, 0};
    struct Steinberg_Vst_AudioBusBuffers out = {2, 0, {0}};
    out.Steinberg_Vst_AudioBusBuffers_channelBuffers32 = chans;
    double busy = 0.0;
    for (uint32_t start = 0; start < total; start += (uint32_t)block) {
        uint32_t n = total - start < (uint32_t)block ? total - start : (uint32_t)block;
        list.n = 0;
        for (int i = 0; i < nn; ++i) {
            if (notes[i].at < start || notes[i].at >= start + n || notes[i].kind > 1) continue;
            struct Steinberg_Vst_Event *e = &list.e[list.n++];
            memset(e, 0, sizeof *e);
            e->sampleOffset = (Steinberg_int32)(notes[i].at - start);
            if (notes[i].kind == 0) {
                e->type = Steinberg_Vst_Event_EventTypes_kNoteOnEvent;
                e->Steinberg_Vst_Event_noteOn.pitch = (Steinberg_int16)notes[i].key;
                e->Steinberg_Vst_Event_noteOn.velocity = (float)notes[i].vel;
                e->Steinberg_Vst_Event_noteOn.noteId = -1;
            } else {
                e->type = Steinberg_Vst_Event_EventTypes_kNoteOffEvent;
                e->Steinberg_Vst_Event_noteOff.pitch = (Steinberg_int16)notes[i].key;
                e->Steinberg_Vst_Event_noteOff.noteId = -1;
            }
        }
        struct Steinberg_Vst_ProcessData pd = {0};
        pd.processMode = Steinberg_Vst_ProcessModes_kRealtime;
        pd.symbolicSampleSize = Steinberg_Vst_SymbolicSampleSizes_kSample32;
        pd.numSamples = (Steinberg_int32)n; pd.numOutputs = 1; pd.outputs = &out;
        pd.inputEvents = (struct Steinberg_Vst_IEventList *)&list;
        double t0 = now_s();
        if (proc->lpVtbl->process(proc, &pd) != Steinberg_kResultOk) return fail("process failed");
        busy += now_s() - t0;
        for (uint32_t i = 0; i < n; ++i) { all[2 * (start + i)] = l[i]; all[2 * (start + i) + 1] = r[i]; }
    }
    proc->lpVtbl->setProcessing(proc, 0);
    comp->lpVtbl->setActive(comp, 0);
    comp->lpVtbl->terminate(comp);
    proc->lpVtbl->release(proc);
    comp->lpVtbl->release(comp);
    bool (*leave)(void) = (bool (*)(void))find_sym(lib, "ModuleExit");
    if (leave) leave();
    FILE *f = fopen(argv[2], "wb");
    if (!f || fwrite(all, sizeof(float), (size_t)total * 2, f) != (size_t)total * 2) return fail("cannot write output");
    fclose(f);
    printf("{\"name\": \"%s\", \"latency\": %d, \"frames\": %u, \"process_s\": %.9f}\n", info.name, latency, total, busy);
    return 0;
}
