"""Voice prototype, step 2 (CPU): the old way and the new way from the same takes (VOICE-BIBLE section 7).

    node tools/gpu-lock.mjs run --lock heavy-cpu "voice proto mix" -- python tools/voice/mix_scene.py SCRIPT.json OUTDIR

old  every line in the source voice as synthesised, joined with even gaps, mono, no direction, inner
     voices sounding like everyone else: the method the game would get from a plain TTS pass.
new  per character: the profile's voice (design/voice/profiles.json) made from the same takes by our
     own converter (TD-PSOLA pitch, contour and rate, cepstral formant warp; the explainer guides'
     code, 2026-10-11-explainer-characters/narration/voices.py); per line: the direction's deltas
     (direction.mjs renderParams, computed into the script); cues placed as silence, breath and
     overlap; people in the Brine's room (pan, distance, a short room), inner voices dry and close
     inside the head (near-field ITD and level pan, proximity bass, no room), the Damp as an object at
     the hip (a designed resonator, no person's likeness).
Writes OUTDIR/old.wav, new.wav (48 kHz, -16 LUFS), inner-stem.wav (the head alone), timeline.json (each
line's start, end, who, direction and the portrait cue with a jaw track at 30 fps).
"""
import json, math, os, sys
from pathlib import Path
import numpy as np, soundfile as sf, pyloudnorm as pyln, librosa
from scipy.signal import lfilter, butter, sosfilt, resample_poly, fftconvolve

sys.path.insert(0, os.environ["LW_NARRATION_LIB"])  # the in-house narration modules (voices, vocoder)
import voices as VX  # noqa: E402  (psola, warp, biquad: in-house)
import vocoder as VO  # noqa: E402

SR, OUT_SR = 24000, 48000
TTS = Path(os.environ["LW_VOICE_OUT"]) / "new"
ROOT = Path(__file__).resolve().parents[2]
P = json.loads((ROOT / "design/voice/profiles.json").read_text(encoding="utf-8"))
RNG = np.random.default_rng(20261021)

COLOUR = {   # (kind, f0, gain dB[, q]) chains, RBJ biquads from voices.py
    "narrator": [("low", 160, 1.5), ("peak", 3000, -1.5, 1.0)],
    "lamb": [("peak", 1800, 1.5, 1.2)],
    "outdoor": [("low", 200, 2.5), ("high", 5000, -3.0), ("peak", 900, 1.5, 1.0)],
    "inner": [("low", 150, 3.0), ("high", 6000, -2.0)],
}


def take(i, k):
    y, sr = sf.read(str(TTS / f"L{i:02d}s{k}.wav"), dtype="float64")
    y = resample_poly(y, SR, sr) if sr != SR else y
    a = np.flatnonzero(np.abs(y) > 0.01 * np.max(np.abs(y)))     # trim the model's lead-in and tail silence
    return y[max(0, a[0] - 240): a[-1] + 480] if len(a) else y


def chain(y, spec):
    for s in spec:
        b, a = VX.biquad(s[0], s[1], s[2], *(s[3:] or []))
        y = lfilter(b, a, y)
    return y


def whisper(y, rate, beta):
    """Unvoiced re-synthesis: the envelope kept, the pitch removed (our vocoder with f0 = 0)."""
    A = VO.analyse(y)
    env = A["env"]
    Fq = VO.F
    b = np.interp(Fq, [0, 600, 1200, SR / 2], [beta[0], beta[0], beta[1], beta[1]])
    env = np.stack([np.interp(np.clip(Fq / b, 0, SR / 2), Fq, e) for e in env])
    m = max(1, int(round(len(env) / rate)))
    idx = np.minimum((np.arange(m) * rate).astype(int), len(env) - 1)
    ap = np.ones_like(A["ap"][idx])
    return VO.synthesise(np.zeros(m), env[idx], ap, A["bands"], m * VO.HOP, rms=A["rms"][idx] * 0.7)


def breath(dur=0.35, level_db=-24):
    n = int(dur * SR)
    x = sosfilt(butter(2, [500, 3500], btype="band", fs=SR, output="sos"), RNG.standard_normal(n))
    env = np.sin(np.linspace(0, math.pi, n)) ** 1.5
    return x * env * 10 ** (level_db / 20) * 0.08


def settings(L):
    """The character's synth for this line, with the direction's deltas on top."""
    who, kind, r = L["who"], L["kind"], L["render"]
    if kind == "voice" and ("THE " + who.upper()) in P["instruments"] or who.upper() in P["instruments"]:
        kind = "inst"                                   # voice: damp: is the instrument speaking
    if kind == "voice":
        base = P["speakers"]["LAMB"]["synth"]
        sk = P["voices"]["skills"].get(who, {}); grp = P["voices"].get(sk.get("group", "nose"), {})
        s = dict(shift=base["shift"] + grp.get("shift", 0) + sk.get("shift", 0), range=base["range"] * sk.get("range", 1),
                 rate=base["rate"] * sk.get("rate", 1), beta=tuple(a * b for a, b in zip(base["beta"], grp.get("beta", [1, 1]))),
                 colour="inner", space="head", pan=sk.get("pan", 0), depth=sk.get("depth", 0.5), creak=sk.get("creak", 0), vol=sk.get("vol"))
    elif kind == "inst":
        ins = P["instruments"].get(who) or P["instruments"].get("THE " + who.upper(), {})
        base = P["speakers"]["LAMB"]["synth"]
        s = dict(shift=base["shift"] + ins.get("shift", 0), range=ins.get("range", 0.6), rate=ins.get("rate", 1), beta=(0.98, 0.95),
                 colour="lamb", space="hip", pan=ins.get("pan", 0.25), resonator=ins.get("resonator"), creak=0)
    else:
        sp = P["speakers"].get(who, P["speakers"]["NARRATOR"])["synth"]
        s = dict(shift=sp["shift"], range=sp["range"], rate=sp["rate"], beta=tuple(sp["beta"]), colour=sp.get("colour", "lamb"),
                 space=sp.get("space", "room"), pan={"MERROW": 0.3, "SABINE": -0.4, "LAMB": -0.08, "NARRATOR": 0.0}.get(who, 0.15), creak=sp.get("creak", 0), vol=sp.get("vol"))
    s["kind"] = kind
    s["shift"] += r["shift"]; s["range"] *= r["range"]; s["rate"] *= r["rate"]
    s["tilt"], s["breath"], s["noise"] = r["tilt"], r["breath"], r["noise"]
    if s.get("vol") == "whisper": s["noise"] = 1
    if s.get("vol") == "low": s["noise"] = max(s["noise"], 0.25)
    return s


def convert(y, s):
    v = VX.psola(y, s["shift"], s["range"], s["rate"], s.get("creak", 0.0))
    v = VX.warp(v, s["beta"] if isinstance(s["beta"], tuple) else (s["beta"], s["beta"]))
    if s["noise"] > 0:
        w = whisper(y, s["rate"], s["beta"])
        n = min(len(v), len(w)); v = v[:n] * (1 - s["noise"]) + w[:n] * s["noise"] * 1.6
    v = chain(v, COLOUR.get(s["colour"], COLOUR["lamb"]))
    if abs(s["tilt"]) > 0.1:
        b, a = VX.biquad("high", 2000, s["tilt"]); v = lfilter(b, a, v)
    if s.get("resonator") == "hair":   # the Damp: a voice through a taut hair: a short feedback comb and a slow flutter
        d = int(SR / 310)
        v = lfilter([1.0], np.r_[1.0, np.zeros(d - 1), -0.55], v) * 0.8
        v = v * (1 + 0.12 * np.sin(2 * math.pi * 5.5 * np.arange(len(v)) / SR))
    if s["breath"] is not None:
        env = np.convolve(np.abs(v), np.ones(480) / 480, mode="same")
        v = v + sosfilt(butter(4, 1800, btype="high", fs=SR, output="sos"), RNG.standard_normal(len(v))) * env * 10 ** (s["breath"] / 20)
    return v


def room_ir(rt60=0.45, pre=0.012):
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    tail = RNG.standard_normal(n) * np.exp(-6.9 * t / rt60)
    tail = sosfilt(butter(2, 3500, fs=SR, output="sos"), tail)
    ir = np.zeros(n + int(pre * SR)); ir[0] = 1.0
    for dt, g in [(0.009, 0.35), (0.017, 0.28), (0.023, 0.22), (0.031, 0.18)]:
        ir[int(dt * SR)] += g
    ir[int(pre * SR):] += tail * 0.09
    return ir


IR_L, IR_R = room_ir(), room_ir()


def place(v, s):
    """Mono line to stereo by its space."""
    if s["space"] == "head":
        # inside the head: no room; near-field pan by interaural time (up to 0.6 ms) and level (up to
        # 9 dB), less of both toward the centre of the head (depth 1)
        p, depth = s["pan"], s.get("depth", 0.5)
        k = p * (1 - 0.6 * depth)
        itd = int(abs(k) * 0.0006 * SR)
        g_near, g_far = 1.0, 10 ** (-9 * abs(k) / 20)
        far = np.r_[np.zeros(itd), v][: len(v)] * g_far
        near = v * g_near
        L, R = (near, far) if k < 0 else (far, near)
        return np.stack([L, R], 1) * 0.95
    if s["space"] == "hip":
        dry = v * 0.85
        wet = fftconvolve(v, IR_L)[: len(v)] * 0.18
        g = s["pan"]
        return np.stack([dry * (1 - g) ** 0.5 + wet, dry * (1 + g) ** 0.5 * 0.85 + wet], 1)
    if s["space"] == "page":   # the report: centred, close and dry, a touch of the room so it sits in the scene
        wet = fftconvolve(v, IR_L)[: len(v)] * 0.05
        return np.stack([v + wet, v + wet], 1) * 0.8
    # a person in the room: pan, a little distance (top rolled off), the Brine's short room
    dist = 0.6 if s["space"] in ("room", "floor", "quay") else 0.3
    v = sosfilt(butter(1, 9000 - 3000 * dist, fs=SR, output="sos"), v)
    wl = fftconvolve(v, IR_L)[: len(v)] * (0.15 + 0.2 * dist)
    wr = fftconvolve(v, IR_R)[: len(v)] * (0.15 + 0.2 * dist)
    a = (s["pan"] + 1) * math.pi / 4
    return np.stack([v * math.cos(a) + wl, v * math.sin(a) + wr], 1) * 0.9


def build_line(i, L, s=None):
    """A line's mono audio and where its <cut> falls (seconds), from the takes and the cues."""
    parts, k, cut_at, t = [], 0, None, 0.0
    for seg in L["spoken"]:
        if "say" in seg:
            y = take(i, k); k += 1
            y = convert(y, s) if s else y
            parts.append(y); t += len(y) / SR
        elif s is not None:
            c, d = seg["cue"], seg["s"]
            if c == "cut": cut_at = t; continue
            z = breath(d) if c == "breath" else np.zeros(int(d * SR))
            parts.append(z); t += len(z) / SR
        else:
            z = np.zeros(int(0.12 * SR)); parts.append(z); t += 0.12   # old: an even small gap, cues ignored
    return np.concatenate(parts), cut_at


def gap(prev, cur):
    if prev is None: return 0.6
    if cur["kind"] == "voice": return 0.18            # a voice interjects quickly
    if prev["who"] == "LAMB": return 0.5              # an answer, after a beat
    if prev["kind"] == "nar": return 0.35
    return 0.45


def master(y, sr):
    m = pyln.Meter(sr)
    g = -16.0 - m.integrated_loudness(y)
    y = y * 10 ** (g / 20)
    pk = np.max(np.abs(y))
    if pk > 0.89:   # a soft knee to -1 dBFS on the few peaks above it
        y = np.sign(y) * np.where(np.abs(y) > 0.7, 0.7 + (0.89 - 0.7) * np.tanh((np.abs(y) - 0.7) / (0.89 - 0.7)), np.abs(y))
    return y, round(float(m.integrated_loudness(y)), 2)


def jaw_track(v, fps=30):
    hop = SR // fps
    r = np.array([np.sqrt(np.mean(v[j:j + hop] ** 2)) for j in range(0, len(v), hop)]) if len(v) else np.zeros(0)
    return [round(float(x), 2) for x in np.clip(r / (np.percentile(r, 95) + 1e-9), 0, 1)]


def main():
    script, out = json.load(open(sys.argv[1], encoding="utf-8")), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    lines = script["lines"]
    # old: one voice, even gaps, mono
    old, prev, otl, t0 = [], None, [], 0.0
    for i, L in enumerate(lines):
        y, _ = build_line(i, L)
        g = 0.6 if prev is None else 0.45
        old += [np.zeros(int(g * SR)), y]; prev = L
        t0 += int(g * SR) / SR; otl.append({"line": i, "start": round(t0, 3), "end": round(t0 + len(y) / SR, 3)}); t0 += len(y) / SR
    old = np.concatenate(old + [np.zeros(int(0.8 * SR))])
    o48, lo = master(resample_poly(old, 2, 1), OUT_SR)
    sf.write(str(out / "old.wav"), o48.astype(np.float32), OUT_SR, subtype="PCM_24")
    # new
    rendered, t, prev, prev_end, prev_cut, tl = [], 0.0, None, 0.0, None, []
    for i, L in enumerate(lines):
        s = settings(L)
        v, cut_at = build_line(i, L, s)
        if L["dir"].get("over") and prev_cut is not None:
            start = prev_cut                                 # speak over the previous line from its <cut>
        else:
            start = prev_end + gap(prev, L)
        st = place(v, s)
        rendered.append((start, st, L, s, v))
        tl.append({"line": i, "who": L["who"], "kind": s["kind"], "text": L["text"], "start": round(start, 3), "end": round(start + len(v) / SR, 3),
                   "dir": L["dir"], "space": s["space"], "portrait": L["portrait"], "jaw30": jaw_track(v) if L["portrait"] else None})
        prev, prev_end = L, max(prev_end, start + len(v) / SR)
        prev_cut = start + cut_at if cut_at is not None else None
    n = int((prev_end + 0.9) * SR)
    mix, head = np.zeros((n, 2)), np.zeros((n, 2))
    for k, (start, st, L, s, v) in enumerate(rendered):
        a = int(start * SR)
        # a line that is spoken over ducks by 7 dB from the overlap on
        nxt = rendered[k + 1] if k + 1 < len(rendered) else None
        if nxt and nxt[2]["dir"].get("over"):
            d = int((nxt[0] - start) * SR)
            if 0 < d < len(st):
                ramp = np.r_[np.ones(d), np.linspace(1, 10 ** (-7 / 20), min(2400, len(st) - d)), np.full(max(0, len(st) - d - 2400), 10 ** (-7 / 20))][: len(st)]
                st = st * ramp[:, None]
        mix[a:a + len(st)] += st
        if s["space"] == "head": head[a:a + len(st)] += st
    m48 = resample_poly(mix, 2, 1, axis=0); h48 = resample_poly(head, 2, 1, axis=0)
    m48, ln = master(m48, OUT_SR); h48, lh = master(h48, OUT_SR)
    sf.write(str(out / "new.wav"), m48.astype(np.float32), OUT_SR, subtype="PCM_24")
    sf.write(str(out / "inner-stem.wav"), h48.astype(np.float32), OUT_SR, subtype="PCM_24")
    meta = {"old": {"seconds": round(len(o48) / OUT_SR, 2), "lufs": lo}, "new": {"seconds": round(len(m48) / OUT_SR, 2), "lufs": ln},
            "inner_stem": {"lufs": lh}, "settings": {str(r[2]["who"]) + f"#{k}": {kk: (list(vv) if isinstance(vv, tuple) else vv) for kk, vv in r[3].items()} for k, r in enumerate(rendered)}}
    (out / "timeline.json").write_text(json.dumps({"meta": meta, "lines": tl, "old_lines": otl}, indent=1), encoding="utf-8")
    print(json.dumps(meta["old"]), json.dumps(meta["new"]))


if __name__ == "__main__":
    main()
