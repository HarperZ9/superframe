// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
//
// The superframe instruments as VST3 plug-ins: a thin layer over the CLAP instruments in this bundle (bars.c,
// piano.c, organ.c), written in C against Steinberg's VST3 C API (include/vst3_c_api.h, BSD 3-clause, from
// steinbergmedia/vst3_c_api v3.8.1_build_84). Each class is one object that is the component, the audio
// processor and an edit controller with no parameters (a single-component plug-in). process() turns the VST3
// note events into CLAP note events at the same sample offsets and runs the CLAP instrument straight into the
// host's output buffers, so the VST3 output equals the CLAP output bit for bit (tests/test_vst3.py).
//
// Limits: 32-bit samples, 44.1 or 48 kHz, one stereo output and one event input, no parameters or state, no
// editor. Velocity crosses as the float VST3 carries. The organ keeps its default stops: VST3 events carry no
// program change, and a stops parameter is future work.
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

#include <clap/clap.h>

#include "vst3_c_api.h"

#if defined(_WIN32)
#define VST3_EXPORT __declspec(dllexport)
#else
#define VST3_EXPORT __attribute__((visibility("default")))
#endif

extern const clap_plugin_entry_t clap_entry;           // bars.c

#define N_CLASSES 3
#define MAX_NOTES 512
static const Steinberg_TUID class_ids[N_CLASSES] = {
    SMTG_INLINE_UID(0x5346B001, 0x2026110A, 0x9B3A0001, 0x0000BA25),    // superframe bars
    SMTG_INLINE_UID(0x5346B001, 0x2026110A, 0x9B3A0002, 0x0000F1A0),    // superframe piano
    SMTG_INLINE_UID(0x5346B001, 0x2026110A, 0x9B3A0003, 0x000040A6),    // superframe organ
};

typedef struct {
    const Steinberg_Vst_IComponentVtbl *component;          // the three interface pointers the host holds
    const Steinberg_Vst_IAudioProcessorVtbl *processor;
    const Steinberg_Vst_IEditControllerVtbl *controller;
    int refs, index, active, processing;
    double fs;
    int32_t max_block;
    const clap_plugin_t *clap;
    clap_event_note_t notes[MAX_NOTES];
    const clap_event_header_t *heads[MAX_NOTES];
    uint32_t n_notes;
} plug_t;

#define FROM(field, p) ((plug_t *)((char *)(p) - offsetof(plug_t, field)))
#define OK Steinberg_kResultOk
#define FALSE_ Steinberg_kResultFalse
#define BAD Steinberg_kInvalidArgument
#define CALL SMTG_STDMETHODCALLTYPE
typedef Steinberg_tresult res_t;

static int same(const void *a, const void *b) { return memcmp(a, b, sizeof(Steinberg_TUID)) == 0; }

static res_t query(plug_t *s, const Steinberg_TUID iid, void **obj) {
    if (same(iid, Steinberg_FUnknown_iid) || same(iid, Steinberg_IPluginBase_iid) || same(iid, Steinberg_Vst_IComponent_iid))
        *obj = &s->component;
    else if (same(iid, Steinberg_Vst_IAudioProcessor_iid)) *obj = &s->processor;
    else if (same(iid, Steinberg_Vst_IEditController_iid)) *obj = &s->controller;
    else { *obj = NULL; return Steinberg_kNoInterface; }
    s->refs++;
    return OK;
}

static Steinberg_uint32 unref(plug_t *s) {
    if (--s->refs > 0) return (Steinberg_uint32)s->refs;
    if (s->clap) {
        if (s->processing) s->clap->stop_processing(s->clap);
        if (s->active) s->clap->deactivate(s->clap);
        s->clap->destroy(s->clap);
    }
    free(s);
    return 0;
}

#define UNKNOWN(prefix, field)                                                                                   \
    static res_t CALL prefix##_query(void *p, const Steinberg_TUID iid, void **o) { return query(FROM(field, p), iid, o); } \
    static Steinberg_uint32 CALL prefix##_ref(void *p) { return (Steinberg_uint32)++FROM(field, p)->refs; }    \
    static Steinberg_uint32 CALL prefix##_unref(void *p) { return unref(FROM(field, p)); }

UNKNOWN(c, component)
UNKNOWN(a, processor)
UNKNOWN(e, controller)

static const void *host_ext(const clap_host_t *h, const char *id) { (void)h; (void)id; return NULL; }
static void host_nop(const clap_host_t *h) { (void)h; }
static const clap_host_t clap_host = {CLAP_VERSION_INIT, NULL, "superframe vst3", "superframe", "", "0.1.0",
                                      host_ext, host_nop, host_nop, host_nop};

static const clap_plugin_descriptor_t *clap_desc(int i) {
    const clap_plugin_factory_t *f = clap_entry.get_factory(CLAP_PLUGIN_FACTORY_ID);
    return f->get_plugin_descriptor(f, (uint32_t)i);
}

// IComponent
static res_t CALL c_init(void *p, struct Steinberg_FUnknown *ctx) {
    (void)ctx;
    plug_t *s = FROM(component, p);
    if (s->clap) return OK;
    const clap_plugin_factory_t *f = clap_entry.get_factory(CLAP_PLUGIN_FACTORY_ID);
    s->clap = f->create_plugin(f, &clap_host, clap_desc(s->index)->id);
    return s->clap && s->clap->init(s->clap) ? OK : FALSE_;
}
static res_t CALL c_term(void *p) { (void)p; return OK; }
static res_t CALL c_ctrl_id(void *p, Steinberg_TUID id) { (void)p; (void)id; return FALSE_; }
static res_t CALL c_io_mode(void *p, Steinberg_Vst_IoMode m) { (void)p; (void)m; return OK; }

static Steinberg_int32 CALL c_bus_count(void *p, Steinberg_Vst_MediaType t, Steinberg_Vst_BusDirection d) {
    (void)p;
    if (t == Steinberg_Vst_MediaTypes_kAudio && d == Steinberg_Vst_BusDirections_kOutput) return 1;
    if (t == Steinberg_Vst_MediaTypes_kEvent && d == Steinberg_Vst_BusDirections_kInput) return 1;
    return 0;
}

static void name16(Steinberg_char16 *dst, const char *src) {
    int i = 0;
    for (; src[i] && i < 127; ++i) dst[i] = (Steinberg_char16)src[i];
    dst[i] = 0;
}

static res_t CALL c_bus_info(void *p, Steinberg_Vst_MediaType t, Steinberg_Vst_BusDirection d, Steinberg_int32 i,
                             struct Steinberg_Vst_BusInfo *b) {
    if (i != 0 || c_bus_count(p, t, d) != 1) return BAD;
    memset(b, 0, sizeof *b);
    b->mediaType = t; b->direction = d; b->busType = Steinberg_Vst_BusTypes_kMain;
    b->flags = Steinberg_Vst_BusInfo_BusFlags_kDefaultActive;
    b->channelCount = t == Steinberg_Vst_MediaTypes_kAudio ? 2 : 16;
    name16(b->name, t == Steinberg_Vst_MediaTypes_kAudio ? "main" : "notes");
    return OK;
}
static res_t CALL c_routing(void *p, struct Steinberg_Vst_RoutingInfo *a, struct Steinberg_Vst_RoutingInfo *b) {
    (void)p; (void)a; (void)b; return FALSE_;
}
static res_t CALL c_act_bus(void *p, Steinberg_Vst_MediaType t, Steinberg_Vst_BusDirection d, Steinberg_int32 i,
                            Steinberg_TBool on) {
    (void)on; return i == 0 && c_bus_count(p, t, d) == 1 ? OK : BAD;
}

static res_t CALL c_active(void *p, Steinberg_TBool on) {
    plug_t *s = FROM(component, p);
    if (!s->clap) return FALSE_;
    if (on && !s->active) {
        if (!s->clap->activate(s->clap, s->fs, 1, (uint32_t)s->max_block)) return FALSE_;
        s->active = 1;
    } else if (!on && s->active) {
        if (s->processing) { s->clap->stop_processing(s->clap); s->processing = 0; }
        s->clap->deactivate(s->clap);
        s->active = 0;
    }
    return OK;
}
static res_t CALL c_state(void *p, struct Steinberg_IBStream *st) { (void)p; (void)st; return OK; }

static const Steinberg_Vst_IComponentVtbl component_vtbl = {
    c_query, c_ref, c_unref, c_init, c_term, c_ctrl_id, c_io_mode, c_bus_count, c_bus_info, c_routing, c_act_bus,
    c_active, c_state, c_state};

// IAudioProcessor
static res_t CALL a_set_arr(void *p, Steinberg_Vst_SpeakerArrangement *in, Steinberg_int32 ni,
                            Steinberg_Vst_SpeakerArrangement *out, Steinberg_int32 no) {
    (void)p; (void)in;
    return ni == 0 && no == 1 && out[0] == Steinberg_Vst_SpeakerArr_kStereo ? OK : FALSE_;
}
static res_t CALL a_get_arr(void *p, Steinberg_Vst_BusDirection d, Steinberg_int32 i, Steinberg_Vst_SpeakerArrangement *arr) {
    (void)p;
    if (d != Steinberg_Vst_BusDirections_kOutput || i != 0) return BAD;
    *arr = Steinberg_Vst_SpeakerArr_kStereo;
    return OK;
}
static res_t CALL a_can(void *p, Steinberg_int32 size) {
    (void)p; return size == Steinberg_Vst_SymbolicSampleSizes_kSample32 ? OK : FALSE_;
}
static Steinberg_uint32 CALL a_latency(void *p) { (void)p; return 0; }
static Steinberg_uint32 CALL a_tail(void *p) { (void)p; return Steinberg_Vst_kInfiniteTail; }

static res_t CALL a_setup(void *p, struct Steinberg_Vst_ProcessSetup *su) {
    plug_t *s = FROM(processor, p);
    if (su->symbolicSampleSize != Steinberg_Vst_SymbolicSampleSizes_kSample32) return FALSE_;
    if (su->sampleRate != 44100.0 && su->sampleRate != 48000.0) return FALSE_;
    s->fs = su->sampleRate;
    s->max_block = su->maxSamplesPerBlock;
    return OK;
}
static res_t CALL a_processing(void *p, Steinberg_TBool on) {
    plug_t *s = FROM(processor, p);
    if (!s->active) return FALSE_;
    if (on && !s->processing) s->processing = s->clap->start_processing(s->clap);
    else if (!on && s->processing) { s->clap->stop_processing(s->clap); s->processing = 0; }
    return OK;
}

static uint32_t ev_size(const clap_input_events_t *l) { return ((const plug_t *)l->ctx)->n_notes; }
static const clap_event_header_t *ev_get(const clap_input_events_t *l, uint32_t i) { return ((const plug_t *)l->ctx)->heads[i]; }
static bool ev_push(const clap_output_events_t *l, const clap_event_header_t *e) { (void)l; (void)e; return true; }

static void take_events(plug_t *s, struct Steinberg_Vst_IEventList *in) {
    s->n_notes = 0;
    Steinberg_int32 count = in ? in->lpVtbl->getEventCount(in) : 0;
    for (Steinberg_int32 i = 0; i < count && s->n_notes < MAX_NOTES; ++i) {
        struct Steinberg_Vst_Event e;
        if (in->lpVtbl->getEvent(in, i, &e) != OK) continue;
        int on = e.type == Steinberg_Vst_Event_EventTypes_kNoteOnEvent;
        if (!on && e.type != Steinberg_Vst_Event_EventTypes_kNoteOffEvent) continue;
        clap_event_note_t *n = &s->notes[s->n_notes];
        n->header = (clap_event_header_t){sizeof *n, (uint32_t)e.sampleOffset, CLAP_CORE_EVENT_SPACE_ID,
                                          on ? CLAP_EVENT_NOTE_ON : CLAP_EVENT_NOTE_OFF, 0};
        n->port_index = 0;
        if (on) {
            n->note_id = e.Steinberg_Vst_Event_noteOn.noteId; n->channel = e.Steinberg_Vst_Event_noteOn.channel;
            n->key = e.Steinberg_Vst_Event_noteOn.pitch; n->velocity = (double)e.Steinberg_Vst_Event_noteOn.velocity;
        } else {
            n->note_id = e.Steinberg_Vst_Event_noteOff.noteId; n->channel = e.Steinberg_Vst_Event_noteOff.channel;
            n->key = e.Steinberg_Vst_Event_noteOff.pitch; n->velocity = (double)e.Steinberg_Vst_Event_noteOff.velocity;
        }
        s->heads[s->n_notes++] = &n->header;
    }
}

static res_t CALL a_process(void *p, struct Steinberg_Vst_ProcessData *d) {
    plug_t *s = FROM(processor, p);
    if (d->numSamples <= 0 || d->numOutputs < 1) return OK;                     // a parameter flush
    if (!s->active || d->symbolicSampleSize != Steinberg_Vst_SymbolicSampleSizes_kSample32) return FALSE_;
    take_events(s, d->inputEvents);
    clap_input_events_t cin = {s, ev_size, ev_get};
    clap_output_events_t cout = {NULL, ev_push};
    clap_audio_buffer_t out = {d->outputs[0].Steinberg_Vst_AudioBusBuffers_channelBuffers32, NULL,
                               (uint32_t)d->outputs[0].numChannels, 0, 0};
    clap_process_t pr = {0};
    pr.steady_time = -1;
    pr.frames_count = (uint32_t)d->numSamples;
    pr.audio_outputs = &out; pr.audio_outputs_count = 1;
    pr.in_events = &cin; pr.out_events = &cout;
    d->outputs[0].silenceFlags = 0;
    return s->clap->process(s->clap, &pr) == CLAP_PROCESS_ERROR ? FALSE_ : OK;
}

static const Steinberg_Vst_IAudioProcessorVtbl processor_vtbl = {
    a_query, a_ref, a_unref, a_set_arr, a_get_arr, a_can, a_latency, a_setup, a_processing, a_process, a_tail};

// IEditController: no parameters, no editor.
static res_t CALL e_init(void *p, struct Steinberg_FUnknown *c) { (void)p; (void)c; return OK; }
static res_t CALL e_term(void *p) { (void)p; return OK; }
static res_t CALL e_state(void *p, struct Steinberg_IBStream *st) { (void)p; (void)st; return OK; }
static Steinberg_int32 CALL e_count(void *p) { (void)p; return 0; }
static res_t CALL e_info(void *p, Steinberg_int32 i, struct Steinberg_Vst_ParameterInfo *info) {
    (void)p; (void)i; (void)info; return BAD;
}
static res_t CALL e_to_str(void *p, Steinberg_Vst_ParamID id, Steinberg_Vst_ParamValue v, Steinberg_Vst_String128 s) {
    (void)p; (void)id; (void)v; (void)s; return BAD;
}
static res_t CALL e_from_str(void *p, Steinberg_Vst_ParamID id, Steinberg_Vst_TChar *s, Steinberg_Vst_ParamValue *v) {
    (void)p; (void)id; (void)s; (void)v; return BAD;
}
static Steinberg_Vst_ParamValue CALL e_conv(void *p, Steinberg_Vst_ParamID id, Steinberg_Vst_ParamValue v) { (void)p; (void)id; return v; }
static Steinberg_Vst_ParamValue CALL e_get(void *p, Steinberg_Vst_ParamID id) { (void)p; (void)id; return 0.0; }
static res_t CALL e_set(void *p, Steinberg_Vst_ParamID id, Steinberg_Vst_ParamValue v) { (void)p; (void)id; (void)v; return BAD; }
static res_t CALL e_handler(void *p, struct Steinberg_Vst_IComponentHandler *h) { (void)p; (void)h; return OK; }
static struct Steinberg_IPlugView *CALL e_view(void *p, Steinberg_FIDString n) { (void)p; (void)n; return NULL; }

static const Steinberg_Vst_IEditControllerVtbl controller_vtbl = {
    e_query, e_ref, e_unref, e_init, e_term, e_state, e_state, e_state, e_count, e_info, e_to_str, e_from_str,
    e_conv, e_conv, e_get, e_set, e_handler, e_view};

// The factory
static res_t CALL f_query(void *p, const Steinberg_TUID iid, void **o) {
    if (same(iid, Steinberg_FUnknown_iid) || same(iid, Steinberg_IPluginFactory_iid) || same(iid, Steinberg_IPluginFactory2_iid)) {
        *o = p;
        return OK;
    }
    *o = NULL;
    return Steinberg_kNoInterface;
}
static Steinberg_uint32 CALL f_ref(void *p) { (void)p; return 1; }
static res_t CALL f_info(void *p, struct Steinberg_PFactoryInfo *i) {
    (void)p;
    memset(i, 0, sizeof *i);
    strcpy(i->vendor, "Zain Dana Harper");
    strcpy(i->url, "https://github.com/HarperZ9/superframe");
    i->flags = 16;                                        // kUnicode
    return OK;
}
static Steinberg_int32 CALL f_count(void *p) { (void)p; return N_CLASSES; }

static res_t CALL f_class(void *p, Steinberg_int32 i, struct Steinberg_PClassInfo *c) {
    (void)p;
    if (i < 0 || i >= N_CLASSES) return BAD;
    memset(c, 0, sizeof *c);
    memcpy(c->cid, class_ids[i], sizeof(Steinberg_TUID));
    c->cardinality = 0x7FFFFFFF;                          // kManyInstances
    strcpy(c->category, "Audio Module Class");
    strncpy(c->name, clap_desc(i)->name, sizeof c->name - 1);
    return OK;
}
static res_t CALL f_class2(void *p, Steinberg_int32 i, struct Steinberg_PClassInfo2 *c) {
    struct Steinberg_PClassInfo b;
    res_t r = f_class(p, i, &b);
    if (r != OK) return r;
    memset(c, 0, sizeof *c);
    memcpy(c->cid, b.cid, sizeof b.cid);
    c->cardinality = b.cardinality;
    memcpy(c->category, b.category, sizeof b.category);
    memcpy(c->name, b.name, sizeof b.name);
    strcpy(c->subCategories, "Instrument|Synth");
    strcpy(c->vendor, "Zain Dana Harper");
    strncpy(c->version, clap_desc(i)->version, sizeof c->version - 1);
    strcpy(c->sdkVersion, "VST 3.8.1 (C API)");
    return OK;
}
static res_t CALL f_create(void *p, Steinberg_FIDString cid, Steinberg_FIDString iid, void **o) {
    (void)p;
    *o = NULL;
    for (int i = 0; i < N_CLASSES; ++i) {
        if (!same(cid, class_ids[i])) continue;
        plug_t *s = calloc(1, sizeof *s);
        if (!s) return Steinberg_kOutOfMemory;
        s->component = &component_vtbl; s->processor = &processor_vtbl; s->controller = &controller_vtbl;
        s->index = i; s->fs = 48000.0; s->max_block = 4096;
        res_t r = query(s, iid, o);
        if (r != OK) free(s);
        return r;
    }
    return BAD;
}

static const Steinberg_IPluginFactory2Vtbl factory_vtbl = {f_query, f_ref, f_ref, f_info, f_count, f_class, f_create, f_class2};
static struct { const Steinberg_IPluginFactory2Vtbl *lpVtbl; } factory = {&factory_vtbl};

VST3_EXPORT void *CALL GetPluginFactory(void) { return &factory; }
VST3_EXPORT bool InitDll(void) { return true; }                       // Windows hosts may call these
VST3_EXPORT bool ExitDll(void) { return true; }
VST3_EXPORT bool ModuleEntry(void *h) { (void)h; return true; }       // Linux hosts call these around use
VST3_EXPORT bool ModuleExit(void) { return true; }
