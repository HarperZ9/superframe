// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
//
// superframe organ: the DAW's flue-pipe organ (daw/organ.py voice, wind and play) as a CLAP instrument.
//
// Each pipe is two recurrence oscillators (an impulse through one second-order section, the order scipy's
// sosfilt uses) giving cos and sin of its phase, and the Chebyshev recurrence sin(k t) = 2 cos t sin((k-1) t)
// - sin((k-2) t) for its partials, so no libm sin is called per sample and the doubles match the offline code
// bit for bit (tests/test_clap_organ.py). cos and sin of each pipe's step, partial counts, levels and decays come
// from clap/organ_table.h, written by daw/organ_table.py. The wind is one shared reservoir: pressure follows
// 1 / (1 + 0.04 held pipes) through a first-order section, and every pipe's output is scaled by it.
//
// Keys: a note-on starts one pipe per drawn stop; a note-off releases that key's held pipes over 40 ms.
// Stops: a MIDI program change p draws the stops whose bits are set in p (bit 0 principal 8, 1 octave 4,
// 2 stopped flute 8, 3 nazard 2 2/3, 4 fifteenth 2, 5 tierce 1 3/5); program 0 is ignored. The default is
// principal 8 and octave 4. Velocity is ignored, as on a tracker organ. Up to 256 pipes sound at once; past
// that the oldest is cut, and the offline render, which has no limit, no longer matches.
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include <clap/clap.h>

#include "organ_table.h"

#define ORGAN_PIPES 256
#define ORGAN_GAIN 0.25
#define ORGAN_DEFAULT_STOPS 3u

typedef struct {
    int key, held, count, release;
    int64_t j, n_hold;                   // samples since the key went down; samples it was held
    uint32_t serial;
    double level, d, r, chiff_amp;
    double cos_sec[6], sin_sec[6], zc[2], zs[2];
    const double *lev;
} pipe_t;

typedef struct {
    clap_plugin_t plugin;
    const organ_rate_t *rate;
    pipe_t *p;                           // active pipes in the order they started
    int n, held;
    uint32_t serial, stops;
    double wind_sec[6], wz[2];
} organ_t;

static const char *const organ_features[] = {CLAP_PLUGIN_FEATURE_INSTRUMENT, CLAP_PLUGIN_FEATURE_SYNTHESIZER,
                                             CLAP_PLUGIN_FEATURE_STEREO, NULL};

const clap_plugin_descriptor_t organ_desc = {
    .clap_version = CLAP_VERSION_INIT,
    .id = "io.github.harperz9.superframe.organ",
    .name = "superframe organ",
    .vendor = "Zain Dana Harper",
    .url = "https://github.com/HarperZ9/superframe",
    .manual_url = "https://github.com/HarperZ9/superframe/tree/main/packages/daw",
    .support_url = "https://github.com/HarperZ9/superframe/issues",
    .version = "0.1.0",
    .description = "Flue pipes cut from the air column, with a shared wind that sags; output equals the offline render",
    .features = organ_features,
};

static double sos_tick(const double *c, double *z, double x) {
    double y = c[0] * x + z[0];
    z[0] = c[1] * x - c[4] * y + z[1];
    z[1] = c[2] * x - c[5] * y;
    return y;
}

static double noise(uint32_t serial, int64_t j) {
    uint64_t z = ((uint64_t)serial << 32) | (uint64_t)j;
    z += 0x9E3779B97F4A7C15ull;
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ull;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBull;
    z ^= z >> 31;
    return ((double)(z >> 11) * 0x1p-53) * 2.0 - 1.0;
}

static void drop(organ_t *s, int i) {
    if (s->p[i].held) s->held--;
    memmove(&s->p[i], &s->p[i + 1], (size_t)(s->n - i - 1) * sizeof(pipe_t));
    s->n--;
}

static void key_down(organ_t *s, int key) {
    if (key < ORGAN_KEY0 || key >= ORGAN_KEY0 + ORGAN_KEYS) return;
    for (int si = 0; si < ORGAN_STOPS; ++si) {
        if (!(s->stops >> si & 1u)) continue;
        if (s->n == ORGAN_PIPES) drop(s, 0);
        const organ_coef_t *k = &s->rate->coef[si][key - ORGAN_KEY0];
        pipe_t *v = &s->p[s->n++];
        memset(v, 0, sizeof(*v));
        v->key = key; v->held = 1; v->count = k->count; v->release = s->rate->release;
        v->serial = s->serial++;
        v->level = organ_rank_level[si]; v->r = s->rate->attack;
        v->lev = organ_rank_stopped[si] ? organ_levels_stopped : organ_levels_open;
        v->chiff_amp = k->count >= 2 ? 1.5 * v->lev[1] : 0.0;
        double cc[6] = {1.0, -k->c, 0.0, 1.0, -(k->c + k->c), 1.0};
        double ss[6] = {0.0, k->s, 0.0, 1.0, -(k->c + k->c), 1.0};
        memcpy(v->cos_sec, cc, sizeof cc);
        memcpy(v->sin_sec, ss, sizeof ss);
        s->held++;
    }
}

static void key_up(organ_t *s, int key) {
    for (int i = 0; i < s->n; ++i)
        if (s->p[i].held && s->p[i].key == key) { s->p[i].held = 0; s->p[i].n_hold = s->p[i].j; s->held--; }
}

static double pipe_tick(pipe_t *v) {
    int64_t j = v->j++;
    double x = j == 0 ? 1.0 : 0.0;
    double cw = sos_tick(v->cos_sec, v->zc, x);
    double sw = sos_tick(v->sin_sec, v->zs, x);
    double two_c = cw + cw;
    double tone = 0.0, prev2 = 0.0, prev = sw, s2 = 0.0;
    if (v->count >= 1) tone += v->lev[0] * prev;
    for (int k = 2; k <= v->count; ++k) {
        double cur = two_c * prev - prev2;
        tone += v->lev[k - 1] * cur;
        if (k == 2) s2 = cur;
        prev2 = prev; prev = cur;
    }
    v->d = j == 0 ? 1.0 : v->d * v->r;                    // r^j, one multiply per sample
    double grow = 1.0 - v->d, chiff = v->d * v->d;
    double y = grow * tone + (v->chiff_amp * chiff) * s2;
    double rel = v->held || j < v->n_hold ? 1.0 : 1.0 - (double)(j - v->n_hold) / (double)v->release;
    return (y + (noise(v->serial, j) * chiff) * ORGAN_NOISE) * rel;
}

static bool o_init(const clap_plugin_t *p) { (void)p; return true; }
static void o_destroy(const clap_plugin_t *p) { organ_t *s = p->plugin_data; free(s->p); free(s); }

static void o_clear(organ_t *s) {
    s->n = 0; s->held = 0; s->serial = 0;
    s->wz[0] = s->wz[1] = 0.0;
    double w[6] = {1.0 - s->rate->wind, 0.0, 0.0, 1.0, -s->rate->wind, 0.0};
    memcpy(s->wind_sec, w, sizeof w);
}

static bool o_activate(const clap_plugin_t *p, double fs, uint32_t lo, uint32_t hi) {
    (void)lo; (void)hi;
    organ_t *s = p->plugin_data;
    if (fs == 48000.0) s->rate = &organ_rate_48000;
    else if (fs == 44100.0) s->rate = &organ_rate_44100;
    else return false;                                    // tables exist for 44.1 and 48 kHz only
    free(s->p);
    s->p = calloc(ORGAN_PIPES, sizeof(pipe_t));
    o_clear(s);
    return s->p != NULL;
}

static void o_deactivate(const clap_plugin_t *p) { organ_t *s = p->plugin_data; free(s->p); s->p = NULL; }
static bool o_start(const clap_plugin_t *p) { (void)p; return true; }
static void o_stop(const clap_plugin_t *p) { (void)p; }
static void o_reset(const clap_plugin_t *p) { organ_t *s = p->plugin_data; if (s->p) o_clear(s); }

static void o_run(organ_t *s, const clap_process_t *pr, uint32_t from, uint32_t to) {
    for (uint32_t i = from; i < to; ++i) {
        double target = 1.0 / (1.0 + ORGAN_WIND_K * (double)s->held);
        double press = sos_tick(s->wind_sec, s->wz, target - 1.0) + 1.0;
        double acc = 0.0;
        for (int k = 0; k < s->n;) {
            pipe_t *v = &s->p[k];
            if (!v->held && v->j - v->n_hold >= v->release) { drop(s, k); continue; }
            acc += v->level * (pipe_tick(v) * press);
            ++k;
        }
        float o = (float)(ORGAN_GAIN * acc);
        for (uint32_t c = 0; c < pr->audio_outputs[0].channel_count; ++c) pr->audio_outputs[0].data32[c][i] = o;
    }
}

static clap_process_status o_process(const clap_plugin_t *p, const clap_process_t *pr) {
    organ_t *s = p->plugin_data;
    uint32_t n = pr->frames_count, at = 0;
    uint32_t count = pr->in_events ? pr->in_events->size(pr->in_events) : 0;
    if (pr->audio_outputs_count < 1 || !s->p) return CLAP_PROCESS_ERROR;
    for (uint32_t i = 0; i < count; ++i) {
        const clap_event_header_t *h = pr->in_events->get(pr->in_events, i);
        if (h->space_id != CLAP_CORE_EVENT_SPACE_ID) continue;
        uint32_t t = h->time < n ? h->time : n;
        int key = -1, down = 0;
        if (h->type == CLAP_EVENT_NOTE_ON || h->type == CLAP_EVENT_NOTE_OFF) {
            key = ((const clap_event_note_t *)h)->key;
            down = h->type == CLAP_EVENT_NOTE_ON;
        } else if (h->type == CLAP_EVENT_MIDI) {
            const uint8_t *d = ((const clap_event_midi_t *)h)->data;
            uint8_t st = d[0] & 0xF0;
            if (st == 0xC0) { if (d[1] & 63) s->stops = d[1] & 63; continue; }
            if (st == 0x90 || st == 0x80) { key = d[1]; down = st == 0x90 && d[2] > 0; }
        }
        if (key < 0) continue;
        o_run(s, pr, at, t); at = t;
        if (down) key_down(s, key); else key_up(s, key);
    }
    o_run(s, pr, at, n);
    return CLAP_PROCESS_CONTINUE;
}

extern const void *superframe_shared_extension(const char *id);     // bars.c: ports and latency

static const void *o_extension(const clap_plugin_t *p, const char *id) { (void)p; return superframe_shared_extension(id); }
static void o_main_thread(const clap_plugin_t *p) { (void)p; }

const clap_plugin_t *organ_create(const clap_host_t *host) {
    (void)host;
    organ_t *s = calloc(1, sizeof(organ_t));
    if (!s) return NULL;
    s->stops = ORGAN_DEFAULT_STOPS;
    s->plugin.desc = &organ_desc;
    s->plugin.plugin_data = s;
    s->plugin.init = o_init;
    s->plugin.destroy = o_destroy;
    s->plugin.activate = o_activate;
    s->plugin.deactivate = o_deactivate;
    s->plugin.start_processing = o_start;
    s->plugin.stop_processing = o_stop;
    s->plugin.reset = o_reset;
    s->plugin.process = o_process;
    s->plugin.get_extension = o_extension;
    s->plugin.on_main_thread = o_main_thread;
    return &s->plugin;
}
