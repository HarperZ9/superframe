// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
//
// superframe bars: the DAW's modal bar bank as a CLAP instrument, so it plays inside any CLAP host. This file
// also holds the bundle's factory, which lists the bars and the piano (piano.c).
//
// The sound is the BuildLang kernels themselves (bld/dsp.bld: daw_voice_set, daw_bank_live), compiled by
// buildc to C and linked into this file's shared library by daw/clap_build.py. This file only maps CLAP
// calls onto them: a note sets a voice's modes and strikes it on the event's own sample. A process block is
// split at every event, so the output does not depend on the host's block size. No allocation, lock or file
// access happens in process(); buffers are allocated in activate().
//
// Loss factor: aluminium, eta = 2.263e-4, measured (packages/measured mechanical.json, read by
// daw/materials.py). tests/test_clap.py holds this file to the offline reference with the material's value,
// so a drift here fails the test.
#include <math.h>
#include <stdlib.h>
#include <string.h>

#include <clap/clap.h>

#define BARS_VOICES 16
#define BARS_MODES 12
#define BARS_ETA 2.263e-4
#define BARS_GAIN 0.25

void daw_voice_set(double *a1, double *a2, double *b, double *y1, double *y2, size_t v, size_t modes, double f1,
                   double eta, double amp, double fs);
void daw_bank_live(const double *a1, const double *a2, const double *b, double *y1, double *y2, size_t voices,
                   size_t modes, const double *hits, double *out, size_t frames);
void daw_voice_retune(double *a1, double *a2, size_t v, size_t modes, double key, double eta, double fs);   // bld/mpe.bld

#define BARS_MPE_RANGE 48.0     // semitones for a full MIDI pitch bend on a member channel (the MPE default)

typedef struct {
    clap_plugin_t plugin;
    const clap_host_t *host;
    double fs;
    uint32_t max_frames;
    uint32_t next_voice;
    double *a1, *a2, *b, *y1, *y2, *hits, *scratch;
    int key[BARS_VOICES], channel[BARS_VOICES], note_id[BARS_VOICES];   // who each voice is playing, for MPE
    double bend[16];                                    // the last MIDI pitch bend per channel, in semitones
} bars_t;

static const char *const bars_features[] = {CLAP_PLUGIN_FEATURE_INSTRUMENT, CLAP_PLUGIN_FEATURE_SYNTHESIZER,
                                            CLAP_PLUGIN_FEATURE_STEREO, NULL};

static const clap_plugin_descriptor_t bars_desc = {
    .clap_version = CLAP_VERSION_INIT,
    .id = "io.github.harperz9.superframe.bars",
    .name = "superframe bars",
    .vendor = "Zain Dana Harper",
    .url = "https://github.com/HarperZ9/superframe",
    .manual_url = "https://github.com/HarperZ9/superframe/tree/main/packages/daw",
    .support_url = "https://github.com/HarperZ9/superframe/issues",
    .version = "0.1.0",
    .description = "Struck aluminium bars from measured material values; output equals the offline render",
    .features = bars_features,
};

static double bars_midi_hz(double key) { return 440.0 * pow(2.0, (key - 69.0) / 12.0); }

static void bars_free(bars_t *s) {
    free(s->a1); free(s->a2); free(s->b); free(s->y1); free(s->y2); free(s->hits); free(s->scratch);
    s->a1 = s->a2 = s->b = s->y1 = s->y2 = s->hits = s->scratch = NULL;
}

static bool bars_init(const clap_plugin_t *p) { (void)p; return true; }

static void bars_destroy(const clap_plugin_t *p) {
    bars_t *s = (bars_t *)p->plugin_data;
    bars_free(s);
    free(s);
}

static bool bars_activate(const clap_plugin_t *p, double fs, uint32_t min_frames, uint32_t max_frames) {
    (void)min_frames;
    bars_t *s = (bars_t *)p->plugin_data;
    size_t n = (size_t)BARS_VOICES * BARS_MODES;
    bars_free(s);
    s->fs = fs;
    s->max_frames = max_frames;
    s->next_voice = 0;
    for (int v = 0; v < BARS_VOICES; ++v) { s->key[v] = -1; s->channel[v] = -1; s->note_id[v] = -1; }
    for (int c = 0; c < 16; ++c) s->bend[c] = 0.0;
    s->a1 = calloc(n, sizeof(double)); s->a2 = calloc(n, sizeof(double)); s->b = calloc(n, sizeof(double));
    s->y1 = calloc(n, sizeof(double)); s->y2 = calloc(n, sizeof(double));
    s->hits = calloc(BARS_VOICES, sizeof(double));
    s->scratch = calloc(max_frames ? max_frames : 1, sizeof(double));
    if (!s->a1 || !s->a2 || !s->b || !s->y1 || !s->y2 || !s->hits || !s->scratch) {
        bars_free(s);
        return false;
    }
    return true;
}

static void bars_deactivate(const clap_plugin_t *p) { bars_free((bars_t *)p->plugin_data); }
static bool bars_start(const clap_plugin_t *p) { (void)p; return true; }
static void bars_stop(const clap_plugin_t *p) { (void)p; }

static void bars_reset(const clap_plugin_t *p) {
    bars_t *s = (bars_t *)p->plugin_data;
    size_t n = (size_t)BARS_VOICES * BARS_MODES;
    if (!s->y1) return;
    memset(s->y1, 0, n * sizeof(double));
    memset(s->y2, 0, n * sizeof(double));
}

// Render [from, to) of the block into the outputs; hits holds the strikes due at `from`.
static void bars_run(bars_t *s, const clap_process_t *pr, uint32_t from, uint32_t to) {
    uint32_t frames = to - from;
    if (frames == 0) return;
    daw_bank_live(s->a1, s->a2, s->b, s->y1, s->y2, BARS_VOICES, BARS_MODES, s->hits, s->scratch, frames);
    for (uint32_t c = 0; c < pr->audio_outputs[0].channel_count; ++c) {
        float *o = pr->audio_outputs[0].data32[c] + from;
        for (uint32_t i = 0; i < frames; ++i) o[i] = (float)(BARS_GAIN * s->scratch[i]);
    }
    for (int v = 0; v < BARS_VOICES; ++v) s->hits[v] = -1.0;
}

static void bars_note(bars_t *s, int key, int channel, int note_id, double velocity) {
    uint32_t v = s->next_voice;
    s->next_voice = (v + 1) % BARS_VOICES;
    s->key[v] = key; s->channel[v] = channel; s->note_id[v] = note_id;
    daw_voice_set(s->a1, s->a2, s->b, s->y1, s->y2, v, BARS_MODES, bars_midi_hz((double)key), BARS_ETA, velocity, s->fs);
    if (channel >= 0 && channel < 16 && s->bend[channel] != 0.0)
        daw_voice_retune(s->a1, s->a2, v, BARS_MODES, (double)key + s->bend[channel], BARS_ETA, s->fs);
    s->hits[v] = 0.0;   // struck on the first sample of the next segment, which starts at the event
}

// Per-note tuning (CLAP note expression): the voices that match by note id, or else by key and channel (-1 is
// a wildcard), move to key + semitones.
static void bars_tune(bars_t *s, int note_id, int key, int channel, double semitones) {
    for (int v = 0; v < BARS_VOICES; ++v) {
        if (s->key[v] < 0) continue;
        int hit = note_id >= 0 ? s->note_id[v] == note_id
                               : (key < 0 || s->key[v] == key) && (channel < 0 || s->channel[v] == channel);
        if (hit) daw_voice_retune(s->a1, s->a2, (size_t)v, BARS_MODES, (double)s->key[v] + semitones, BARS_ETA, s->fs);
    }
}

// MPE: a pitch bend on a member channel bends the voices on that channel, by up to BARS_MPE_RANGE semitones.
static void bars_bend(bars_t *s, int channel, int value14) {
    s->bend[channel] = (double)(value14 - 8192) / 8192.0 * BARS_MPE_RANGE;
    for (int v = 0; v < BARS_VOICES; ++v)
        if (s->key[v] >= 0 && s->channel[v] == channel)
            daw_voice_retune(s->a1, s->a2, (size_t)v, BARS_MODES, (double)s->key[v] + s->bend[channel], BARS_ETA, s->fs);
}

static clap_process_status bars_process(const clap_plugin_t *p, const clap_process_t *pr) {
    bars_t *s = (bars_t *)p->plugin_data;
    uint32_t n = pr->frames_count, at = 0;
    uint32_t count = pr->in_events ? pr->in_events->size(pr->in_events) : 0;
    if (pr->audio_outputs_count < 1 || n > s->max_frames) return CLAP_PROCESS_ERROR;
    for (int v = 0; v < BARS_VOICES; ++v) s->hits[v] = -1.0;
    for (uint32_t i = 0; i < count; ++i) {
        const clap_event_header_t *h = pr->in_events->get(pr->in_events, i);
        if (h->space_id != CLAP_CORE_EVENT_SPACE_ID) continue;
        uint32_t t = h->time < n ? h->time : n;
        if (h->type == CLAP_EVENT_NOTE_ON) {
            const clap_event_note_t *e = (const clap_event_note_t *)h;
            bars_run(s, pr, at, t); at = t;
            bars_note(s, e->key, e->channel, e->note_id, e->velocity);
        } else if (h->type == CLAP_EVENT_NOTE_EXPRESSION) {
            const clap_event_note_expression_t *e = (const clap_event_note_expression_t *)h;
            if (e->expression_id != CLAP_NOTE_EXPRESSION_TUNING) continue;
            bars_run(s, pr, at, t); at = t;
            bars_tune(s, e->note_id, e->key, e->channel, e->value);
        } else if (h->type == CLAP_EVENT_MIDI) {
            const clap_event_midi_t *e = (const clap_event_midi_t *)h;
            int status = e->data[0] & 0xF0, ch = e->data[0] & 0x0F;
            if (status == 0x90 && e->data[2] > 0) {
                bars_run(s, pr, at, t); at = t;
                bars_note(s, e->data[1], ch, -1, e->data[2] / 127.0);
            } else if (status == 0xE0) {
                bars_run(s, pr, at, t); at = t;
                bars_bend(s, ch, e->data[1] | (e->data[2] << 7));
            }
        }
    }
    bars_run(s, pr, at, n);
    return CLAP_PROCESS_CONTINUE;
}

static uint32_t ports_count(const clap_plugin_t *p, bool is_input) { (void)p; return is_input ? 0 : 1; }

static bool ports_get(const clap_plugin_t *p, uint32_t index, bool is_input, clap_audio_port_info_t *info) {
    (void)p;
    if (is_input || index != 0) return false;
    info->id = 0;
    strncpy(info->name, "main", CLAP_NAME_SIZE);
    info->flags = CLAP_AUDIO_PORT_IS_MAIN;
    info->channel_count = 2;
    info->port_type = CLAP_PORT_STEREO;
    info->in_place_pair = CLAP_INVALID_ID;
    return true;
}

static const clap_plugin_audio_ports_t bars_audio_ports = {ports_count, ports_get};

static uint32_t notes_count(const clap_plugin_t *p, bool is_input) { (void)p; return is_input ? 1 : 0; }

static bool notes_get(const clap_plugin_t *p, uint32_t index, bool is_input, clap_note_port_info_t *info) {
    (void)p;
    if (!is_input || index != 0) return false;
    info->id = 0;
    info->supported_dialects = CLAP_NOTE_DIALECT_CLAP | CLAP_NOTE_DIALECT_MIDI;
    info->preferred_dialect = CLAP_NOTE_DIALECT_CLAP;
    strncpy(info->name, "notes", CLAP_NAME_SIZE);
    return true;
}

static const clap_plugin_note_ports_t bars_note_ports = {notes_count, notes_get};

static uint32_t latency_get(const clap_plugin_t *p) { (void)p; return 0; }   // no lookahead: strikes land on the event's sample

static const clap_plugin_latency_t bars_latency = {latency_get};

// Shared by every instrument in this bundle: one stereo output, one note input, no latency.
const void *superframe_shared_extension(const char *id) {
    if (!strcmp(id, CLAP_EXT_AUDIO_PORTS)) return &bars_audio_ports;
    if (!strcmp(id, CLAP_EXT_NOTE_PORTS)) return &bars_note_ports;
    if (!strcmp(id, CLAP_EXT_LATENCY)) return &bars_latency;
    return NULL;
}

static const void *bars_extension(const clap_plugin_t *p, const char *id) {
    (void)p;
    return superframe_shared_extension(id);
}

static void bars_main_thread(const clap_plugin_t *p) { (void)p; }

static const clap_plugin_t *bars_create(const clap_host_t *host) {
    bars_t *s = calloc(1, sizeof(bars_t));
    if (!s) return NULL;
    s->host = host;
    s->plugin.desc = &bars_desc;
    s->plugin.plugin_data = s;
    s->plugin.init = bars_init;
    s->plugin.destroy = bars_destroy;
    s->plugin.activate = bars_activate;
    s->plugin.deactivate = bars_deactivate;
    s->plugin.start_processing = bars_start;
    s->plugin.stop_processing = bars_stop;
    s->plugin.reset = bars_reset;
    s->plugin.process = bars_process;
    s->plugin.get_extension = bars_extension;
    s->plugin.on_main_thread = bars_main_thread;
    return &s->plugin;
}

extern const clap_plugin_descriptor_t piano_desc;          // piano.c
const clap_plugin_t *piano_create(const clap_host_t *host);
extern const clap_plugin_descriptor_t organ_desc;          // organ.c
const clap_plugin_t *organ_create(const clap_host_t *host);

static uint32_t factory_count(const clap_plugin_factory_t *f) { (void)f; return 3; }

static const clap_plugin_descriptor_t *factory_desc(const clap_plugin_factory_t *f, uint32_t i) {
    (void)f;
    return i == 0 ? &bars_desc : i == 1 ? &piano_desc : i == 2 ? &organ_desc : NULL;
}

static const clap_plugin_t *factory_create(const clap_plugin_factory_t *f, const clap_host_t *host, const char *id) {
    (void)f;
    if (!clap_version_is_compatible(host->clap_version)) return NULL;
    if (!strcmp(id, bars_desc.id)) return bars_create(host);
    if (!strcmp(id, piano_desc.id)) return piano_create(host);
    if (!strcmp(id, organ_desc.id)) return organ_create(host);
    return NULL;
}

static const clap_plugin_factory_t bars_factory = {factory_count, factory_desc, factory_create};

static bool entry_init(const char *path) { (void)path; return true; }
static void entry_deinit(void) {}

static const void *entry_factory(const char *id) {
    return strcmp(id, CLAP_PLUGIN_FACTORY_ID) ? NULL : &bars_factory;
}

CLAP_EXPORT const clap_plugin_entry_t clap_entry = {CLAP_VERSION_INIT, entry_init, entry_deinit, entry_factory};
