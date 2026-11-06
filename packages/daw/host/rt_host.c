/* SPDX-FileCopyrightText: 2026 Zain Dana Harper
 * SPDX-License-Identifier: FSL-1.1-MIT
 *
 * Real-time stress host (Windows, WASAPI shared mode, event driven). The DSP is the BuildLang core
 * (bld/main.bld, linked as a static library); this file only opens the device, waits for each period's
 * event, calls the BuildLang exports and copies the result out. It is an interim host: the device
 * binding belongs in BuildLang's standard library (DESIGN.md, roadmap step 1).
 *
 *   rt_host VOICES MODES SECONDS [audible]   prints one JSON line: period, latency, render times, deadline misses
 *   The device plays silence unless the fourth argument is "audible"; the rendered samples are still copied.
 *
 * A deadline miss is a period whose render finished later than one period after its event fired, or a
 * period where the device reported less free space than one period (the engine fell behind).
 */
#define COBJMACROS
#include <initguid.h>
#include <audioclient.h>
#include <avrt.h>
#include <math.h>
#include <mmdeviceapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>
#include "main.h"

#define CHECK(hr, what) if (FAILED(hr)) { fprintf(stderr, "%s failed: 0x%08lx\n", what, (unsigned long)(hr)); return 1; }

typedef struct { double *a1, *a2, *b, *y1, *y2, *in, *out; } Voice;

static void voice_init(Voice* v, int modes, int frames, double fs, int index) {
  double *f = calloc(modes, 8), *al = calloc(modes, 8);
  v->a1 = calloc(modes, 8); v->a2 = calloc(modes, 8); v->b = calloc(modes, 8);
  v->y1 = calloc(modes, 8); v->y2 = calloc(modes, 8); v->in = calloc(frames, 8); v->out = calloc(frames, 8);
  for (int k = 0; k < modes; ++k) {   /* a free-bar series on a different root per voice */
    double r = 1.0 + 1.75 * k * (k + 1) * 0.5;
    f[k] = fmin(110.0 * (1 + index % 7) * r, 0.45 * fs - 1);
    al[k] = 2.0 + 0.002 * f[k];
    v->b[k] = 1.0 / (modes * (1 + k));
  }
  daw_modal_coeffs(f, al, (uintptr_t)modes, fs, v->a1, v->a2);
  free(f); free(al);
}

static double now(LARGE_INTEGER fq) { LARGE_INTEGER t; QueryPerformanceCounter(&t); return (double)t.QuadPart / fq.QuadPart; }

static int cmp(const void* a, const void* b) { double x = *(const double*)a, y = *(const double*)b; return (x > y) - (x < y); }

int main(int argc, char** argv) {
  int voices = argc > 1 ? atoi(argv[1]) : 8, modes = argc > 2 ? atoi(argv[2]) : 200;
  double seconds = argc > 3 ? atof(argv[3]) : 10.0;
  DWORD out_flags = (argc > 4 && strcmp(argv[4], "audible") == 0) ? 0 : AUDCLNT_BUFFERFLAGS_SILENT;
  IMMDeviceEnumerator* en; IMMDevice* dev; IAudioClient* ac; IAudioRenderClient* rc; WAVEFORMATEX* wf;
  CHECK(CoInitializeEx(NULL, COINIT_MULTITHREADED), "CoInitializeEx");
  CHECK(CoCreateInstance(&CLSID_MMDeviceEnumerator, NULL, CLSCTX_ALL, &IID_IMMDeviceEnumerator, (void**)&en), "enumerator");
  CHECK(IMMDeviceEnumerator_GetDefaultAudioEndpoint(en, eRender, eConsole, &dev), "default endpoint");
  CHECK(IMMDevice_Activate(dev, &IID_IAudioClient, CLSCTX_ALL, NULL, (void**)&ac), "activate");
  CHECK(IAudioClient_GetMixFormat(ac, &wf), "mix format");
  REFERENCE_TIME def_period, min_period;
  CHECK(IAudioClient_GetDevicePeriod(ac, &def_period, &min_period), "device period");
  CHECK(IAudioClient_Initialize(ac, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_EVENTCALLBACK, 0, 0, wf, NULL), "initialize");
  HANDLE ev = CreateEvent(NULL, FALSE, FALSE, NULL);
  CHECK(IAudioClient_SetEventHandle(ac, ev), "event");
  UINT32 buf_frames; REFERENCE_TIME latency;
  CHECK(IAudioClient_GetBufferSize(ac, &buf_frames), "buffer size");
  CHECK(IAudioClient_GetStreamLatency(ac, &latency), "stream latency");
  CHECK(IAudioClient_GetService(ac, &IID_IAudioRenderClient, (void**)&rc), "render client");
  double fs = wf->nSamplesPerSec; int ch = wf->nChannels;
  int period = (int)llround(def_period * 1e-7 * fs);
  if (wf->wBitsPerSample != 32) { fprintf(stderr, "mix format is not 32-bit float\n"); return 1; }
  Voice* vs = calloc(voices, sizeof(Voice));
  for (int i = 0; i < voices; ++i) voice_init(&vs[i], modes, period, fs, i);
  DWORD task = 0; HANDLE mm = AvSetMmThreadCharacteristicsA("Pro Audio", &task);
  LARGE_INTEGER fq; QueryPerformanceFrequency(&fq);
  int periods = (int)(seconds * fs / period), misses = 0, short_space = 0;
  double* render = calloc(periods, 8); double* mix = calloc(period, 8);
  long long sample = 0;
  CHECK(IAudioClient_Start(ac), "start");
  for (int p = 0; p < periods; ++p) {
    WaitForSingleObject(ev, 2000);
    double t0 = now(fq);
    UINT32 pad; IAudioClient_GetCurrentPadding(ac, &pad);
    UINT32 space = buf_frames - pad, n = space < (UINT32)period ? space : (UINT32)period;
    if (space < (UINT32)period) ++short_space;
    for (UINT32 j = 0; j < n; ++j) mix[j] = 0;
    for (int i = 0; i < voices; ++i) {
      for (UINT32 j = 0; j < n; ++j) vs[i].in[j] = ((sample + j + i * 2400) % 24000 == 0) ? 1.0 : 0.0;
      daw_modal_process(vs[i].a1, vs[i].a2, vs[i].b, vs[i].y1, vs[i].y2, (uintptr_t)modes, vs[i].in, vs[i].out, n);
      for (UINT32 j = 0; j < n; ++j) mix[j] += vs[i].out[j];
    }
    BYTE* data;
    if (SUCCEEDED(IAudioRenderClient_GetBuffer(rc, n, &data))) {
      float* o = (float*)data;
      for (UINT32 j = 0; j < n; ++j) for (int c = 0; c < ch; ++c) o[j * ch + c] = (float)(0.05 * mix[j]);
      IAudioRenderClient_ReleaseBuffer(rc, n, out_flags);
    }
    sample += n;
    render[p] = now(fq) - t0;
    if (render[p] > period / fs) ++misses;
  }
  IAudioClient_Stop(ac);
  if (mm) AvRevertMmThreadCharacteristics(mm);
  qsort(render, periods, 8, cmp);
  printf("{\"rate\":%.0f,\"channels\":%d,\"period_frames\":%d,\"period_ms\":%.3f,\"min_period_ms\":%.3f,"
         "\"buffer_frames\":%u,\"stream_latency_ms\":%.3f,\"voices\":%d,\"modes_per_voice\":%d,\"periods\":%d,"
         "\"render_median_ms\":%.4f,\"render_p99_ms\":%.4f,\"render_max_ms\":%.4f,\"deadline_misses\":%d,"
         "\"short_space_periods\":%d}\n",
         fs, ch, period, period / fs * 1e3, min_period * 1e-4, buf_frames, latency * 1e-4, voices, modes, periods,
         render[periods / 2] * 1e3, render[(int)(periods * 0.99)] * 1e3, render[periods - 1] * 1e3, misses, short_space);
  return 0;
}
