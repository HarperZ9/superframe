# SPDX-License-Identifier: MIT
"""Write vectors/*.json and vectors/MANIFEST.json.

Expected values come from superstack.py, except where an independent anchor
exists (hashlib for SHA-256, FIPS 180 test strings, the BS.1770 reading of a
full-scale sine, the proof's recorded scene hashes). The JavaScript and C++
implementations are written separately and must reproduce every value.

Usage:
  python tools/make_vectors.py           write the files
  python tools/make_vectors.py --check   exit 1 if the files on disk differ from
                                         the generator (floats within 1e-12)
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import superstack as ss  # noqa: E402

VEC = ROOT / "vectors"


# ------------------------------------------------------------------ canonical
def canonical_vectors():
    floats = ["1.0", "1e-07", "1e-7", "0.1", "0.5", "-2.0", "-0.0", "0.0", "1e21", "1e+21", "1e20",
              "9007199254740992.0", "1152921504606846976.0", "1.7976931348623157e308", "5e-324",
              "2.2250738585072014e-308", "-1.5e-10", "366.6666666666667", "366.66666666666669",
              "123456789.125", "0.899999976", "0.000001", "1e-6", "1.5e300", "2.5e-5", "100.0",
              "0.30000000000000004", "4.35", "1234.5678", "-0.001"]
    ints = ["0", "1", "-1", "100", "9007199254740991", "-9007199254740991"]
    numbers = [{"in": s, "type": "float", "out": ss.canonical_number(float(s))} for s in floats]
    numbers += [{"in": s, "type": "int", "out": ss.canonical_number(int(s))} for s in ints]
    reject = [{"in": "9007199254740992", "type": "int"}, {"in": "-9007199254740992", "type": "int"},
              {"in": "NaN", "type": "float"}, {"in": "Infinity", "type": "float"},
              {"in": "-Infinity", "type": "float"}]
    texts = [
        '{"b": 1.0, "a": [0.25, 1e-07], "c": {"z": null, "y": true, "x": "\\u00e9"}}',
        '{"\\uffff": 1, "\\ud83d\\ude00": 2, "a": 3, "B": 4, "\\u00e9": 5, "": 6}',
        '{"s": "\\u0001\\u001f\\u007f\\u2028\\"\\\\/\\b\\f\\n\\r\\t"}',
        '{"empty_obj": {}, "empty_arr": [], "nested": [[[]], {"k": [{}]}]}',
        '{"neg_zero": -0.0, "big": 1e21, "tiny": 5e-324, "int": 42, "f": 42.0, "bools": [true, false, null]}',
        '{"scene": {"kind": "superstack.scene/1", "seed": "raw-default", "t_flicks": 0}}',
        '"just a string"', '12.5', '[]',
    ]
    docs = []
    for t in texts:
        v = json.loads(t)
        c = ss.canonical(v)
        docs.append({"in": t, "out": c, "sha256": hashlib.sha256(c.encode("utf-8")).hexdigest()})
    reject_docs = ['{"s": "\\ud800"}', '{"\\udc00": 1}', '["a\\udfffb"]']
    return {"rule": "canonical JSON v2", "spec": "SPEC.md section 3",
            "numbers": numbers, "reject_numbers": reject, "docs": docs, "reject_docs": reject_docs}


# ------------------------------------------------------------------ hash
def hash_vectors():
    msgs = [b"", b"abc", b"abcdbcdecdefdefgefghfghighijhijkijkljklmnomnopnopq",
            b"a" * 55, b"a" * 56, b"a" * 63, b"a" * 64, b"a" * 65, bytes(range(256)) * 5]
    return {"rule": "SHA-256 (FIPS 180-4), expected values from hashlib", "spec": "SPEC.md section 3.4",
            "cases": [{"hex": m.hex(), "sha256": hashlib.sha256(m).hexdigest()} for m in msgs]}


# ------------------------------------------------------------------ seed
def seed_vectors():
    seeds = ["", "folded-light", "raw-default", "telos", "apples", "été", "\U0001F600",
             "a\U0001F600b￿", ss.substream("folded-light", "voice-3"), "7"]
    cases = []
    for s in seeds:
        r = ss.rng(s)
        u = [r.next_u32() for _ in range(8)]
        r2 = ss.rng(s)
        cases.append({"seed": s, "utf16_units": len(ss.utf16_units(s)), "u32": ss.xmur3(s), "draws_u32": u,
                      "floats": [r2.next_float() for _ in range(3)]})
    mul = []
    for a in (0, 1, 0x6D2B79F5, 0xFFFFFFFF, 123456789):
        m = ss.Mulberry32(a)
        mul.append({"state": a, "draws_u32": [m.next_u32() for _ in range(6)]})
    px = [{"x": x, "y": y, "s": s, "u32": ss.pixel_hash(x, y, s), "unit": ss.pixel_hash01(x, y, s)}
          for x, y, s in [(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1), (128, 128, 63), (255, 255, 127),
                          (4095, 17, 2), (65535, 65535, 65535)]]
    site_parity = {"seed": "folded-light", "first_five": [ss.rng("folded-light").next_float() for _ in range(1)]}
    r = ss.rng("folded-light")
    site_parity["first_five"] = [r.next_float() for _ in range(5)]
    return {"rule": "seed rule xmur3-mulberry32/1 and raw-pixel-hash/1", "spec": "SPEC.md section 4",
            "substream": {"seed": "folded-light", "tag": "voice-3", "out": ss.substream("folded-light", "voice-3")},
            "seeds": cases, "mulberry32": mul, "pixel_hash": px, "site_make_rng": site_parity}


# ------------------------------------------------------------------ clock
def clock_vectors():
    frames = [[24, 1], [25, 1], [30, 1], [48, 1], [50, 1], [60, 1], [90, 1], [120, 1],
              [24000, 1001], [30000, 1001], [60000, 1001]]
    return {"rule": "flick clock", "spec": "SPEC.md section 5", "per_second": ss.FLICKS_PER_SECOND,
            "sample_rates": list(ss.SAMPLE_RATES),
            "per_sample": [{"rate": r, "flicks": ss.flicks_per_sample(r)} for r in ss.SAMPLE_RATES],
            "per_frame": [{"num": n, "den": d, "flicks": ss.flicks_per_frame(n, d)} for n, d in frames],
            "reject_rates": [44000, 22000, 1023, 11, 0], "reject_frames": [[11, 1], [13, 1], [27, 1], [1001, 1], [44, 3], [0, 1], [30, 0]],
            "durations": [{"rate": 48000, "samples": 96000, "flicks": 96000 * ss.flicks_per_sample(48000)},
                          {"rate": 44100, "samples": 44100 * 3600, "flicks": 44100 * 3600 * ss.flicks_per_sample(44100)}]}


# ------------------------------------------------------------------ sound
def synth(sig):
    """Deterministic test signals; every runner synthesizes the same way."""
    rate, ch, n = sig["rate"], sig["channels"], sig["frames"]
    out = []
    for i in range(n):
        for c in range(ch):
            if sig["kind"] == "silence":
                v = 0.0
            else:
                amp = sig["amp"][c]
                if sig["kind"] == "gated" and i >= n // 2:
                    amp = amp * sig["quiet_gain"]
                v = amp * math.sin(2.0 * math.pi * sig["freq"] * i / rate)
            out.append(v)
    return out


def sound_vectors():
    q_in = [0.0, 1.0, -1.0, 0.5, -0.5, 1.5, -2.0, 1.52590218966964e-05, -1.52590218966964e-05,
            0.25, -0.25, 0.999999, -0.999999, 3.0517578125e-05, -0.0]
    quant = [{"in": x, "out": int.from_bytes(ss.quantize_s16([x]), "little", signed=True)} for x in q_in]
    signals = [
        {"name": "sine-997-0dbfs-48k-mono", "kind": "sine", "freq": 997.0, "amp": [1.0], "rate": 48000,
         "channels": 1, "frames": 48000 * 3, "anchor": "BS.1770-4 states a 0 dBFS 1 kHz sine reads -3.01 LKFS"},
        {"name": "sine-997-half-44k1-mono", "kind": "sine", "freq": 997.0, "amp": [0.5], "rate": 44100,
         "channels": 1, "frames": 44100 * 2},
        {"name": "sine-440-stereo-48k", "kind": "sine", "freq": 440.0, "amp": [0.25, 0.125], "rate": 48000,
         "channels": 2, "frames": 48000 * 2},
        {"name": "gated-48k", "kind": "gated", "freq": 1000.0, "amp": [0.5], "quiet_gain": 0.001, "rate": 48000,
         "channels": 1, "frames": 48000 * 4},
        {"name": "two-level-relative-gate-48k", "kind": "gated", "freq": 1000.0, "amp": [0.5], "quiet_gain": 0.2,
         "rate": 48000, "channels": 1, "frames": 48000 * 4,
         "note": "the quiet half sits 14 dB down: inside a 20 LU gate, outside the 10 LU gate"},
        {"name": "sine-100-96k", "kind": "sine", "freq": 100.0, "amp": [0.3], "rate": 96000, "channels": 1,
         "frames": 96000},
        {"name": "silence-48k", "kind": "silence", "amp": [0.0], "rate": 48000, "channels": 1, "frames": 48000},
        {"name": "too-short-48k", "kind": "sine", "freq": 1000.0, "amp": [0.5], "rate": 48000, "channels": 1,
         "frames": 19199},
        {"name": "rate-11025-unsupported", "kind": "sine", "freq": 500.0, "amp": [0.5], "rate": 11025,
         "channels": 1, "frames": 11025},
    ]
    loud = []
    for s in signals:
        x = synth(s)
        loud.append({**s, "integrated_lufs": ss.integrated_lufs(x, s["rate"], s["channels"]),
                     "peak_dbfs": ss.peak_dbfs(x), "tolerance_lu": 1e-6})
    checks = [["speech", -16.0, -3.0], ["speech", -16.9, -1.6], ["speech", -17.2, -3.0], ["speech", -16.0, -1.4],
              ["music", -14.0, -1.0], ["music", -13.0, -2.0], ["music", -12.9, -2.0],
              ["interactive", -18.0, -1.0], ["interactive", -17.9, -6.0], ["interactive", -30.0, -0.5],
              ["speech", None, -3.0], ["music", -14.0, None], ["ambient", -14.0, -3.0]]
    lchk = [{"class": c, "lufs": l, "peak": p, "verdict": ss.loudness_check(c, l, p)} for c, l, p in checks]
    k = {str(r): [list(f) for f in ss.k_weighting(r)] for r in (44100, 48000, 96000)}
    return {"rule": "sound: s16le, loudness meter superstack-bs1770/1, targets", "spec": "SPEC.md section 8",
            "quantize": quant, "loudness": loud, "loudness_check": lchk,
            "targets": ss.LOUDNESS_TARGETS, "k_weighting": k, "k_tolerance": 1e-12}


# ------------------------------------------------------------------ export
def export_vectors():
    pcm = ss.quantize_s16([0.0, 0.5, -0.5, 1.0, -1.0, 0.25])
    rgb = bytes([255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30, 0, 0, 0, 255, 255, 255])
    gray = bytes([0, 64, 128, 255, 1, 2])
    cases = [
        {"format": "wav", "pcm_hex": pcm.hex(), "rate": 48000, "channels": 1},
        {"format": "wav", "pcm_hex": pcm.hex(), "rate": 44100, "channels": 2},
        {"format": "ppm", "body_hex": rgb.hex(), "width": 3, "height": 2},
        {"format": "pgm", "body_hex": gray.hex(), "width": 3, "height": 2},
    ]
    for c in cases:
        if c["format"] == "wav":
            out = ss.wav_s16(bytes.fromhex(c["pcm_hex"]), c["rate"], c["channels"])
            c["header_hex"] = out[:44].hex()
        elif c["format"] == "ppm":
            out = ss.ppm_rgb8(bytes.fromhex(c["body_hex"]), c["width"], c["height"])
        else:
            out = ss.pgm_u8(bytes.fromhex(c["body_hex"]), c["width"], c["height"])
        c["sha256"] = hashlib.sha256(out).hexdigest()
    return {"rule": "export writers", "spec": "SPEC.md section 9", "cases": cases}


# ------------------------------------------------------------------ colour
def colour_vectors():
    hexes = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#808080", "#186844", "#b3261e",
             "#8fdc8a", "#f4f3ef", "#060608"]
    oklab = [{"hex": h, "oklab": ss.hex_to_oklab(h)} for h in hexes]
    labs = [[0.5, 0.1, -0.1], [0.9, -0.05, 0.02], [0.2, 0.0, 0.0]]
    inv = [{"oklab": v, "linear_srgb": ss.oklab_to_linear_srgb(*v)} for v in labs]
    pairs = []
    for pole, toks in ss.RISK_TOKENS.items():
        for name in (*ss.RISK_LEVELS, "ink"):
            for g in ss.RISK_GROUNDS[pole]:
                cr = ss.contrast_ratio(toks[name], g)
                pairs.append({"pole": pole, "token": name, "fg": toks[name], "bg": g, "ratio": cr,
                              "aa_text": cr >= 4.5})
    words = ["MATCH", "verified", "VERIFIED", "UNVERIFIABLE", "drift", "DRIFT", "refuted", "FAIL", " pass ",
             "low", "high", "", None, "nonsense"]
    risk = [{"in": w, "out": ss.risk_of(w)} for w in words]
    hot = [{"in": lv, "out": ss.hot_mark(lv)} for lv in
           ([], ["low"], ["low", "DRIFT", "moderate"], ["high", "FAIL"], ["MATCH", "UNVERIFIABLE", "refuted", "low"])]
    return {"rule": "colour: OKLab and risk tokens", "spec": "SPEC.md section 7", "tolerance": 1e-9,
            "oklab": oklab, "oklab_inverse": inv, "risk_levels": list(ss.RISK_LEVELS),
            "risk_tokens": ss.RISK_TOKENS, "risk_grounds": {k: list(v) for k, v in ss.RISK_GROUNDS.items()},
            "contrast": pairs, "risk_of": risk, "hot_mark": hot}


# ------------------------------------------------------------------ reconcile
def i16(vals):
    return b"".join((v & 0xFFFF).to_bytes(2, "little") for v in vals)


def reconcile_vectors():
    base = [0, 1000, -1000, 32767, -32767, 12345, -5, 7]
    pcm = [
        {"name": "identical", "ref": base, "cand": base},
        {"name": "one-lsb", "ref": base, "cand": [v + (1 if i % 2 else 0) for i, v in enumerate(base[:3])] + base[3:]},
        {"name": "two-lsb-low-snr", "ref": [10, -10, 10, -10], "cand": [12, -8, 12, -8]},
        {"name": "far", "ref": base, "cand": [v // 2 for v in base]},
        {"name": "length", "ref": base, "cand": base[:-1]},
        {"name": "silent-ref", "ref": [0, 0, 0], "cand": [0, 1, 0]},
    ]
    for c in pcm:
        c["expected"] = ss.reconcile_pcm_s16(i16(c["ref"]), i16(c["cand"]))
    img = list(range(0, 240, 10))
    rgb = [
        {"name": "identical", "ref": img, "cand": img},
        {"name": "one-byte-flipped", "ref": img, "cand": img[:4] + [img[4] ^ 1] + img[5:]},
        {"name": "far", "ref": img, "cand": [255 - v for v in img]},
        {"name": "size", "ref": img, "cand": img[:-3]},
    ]
    for c in rgb:
        c["expected"] = ss.reconcile_rgb8(bytes(c["ref"]), bytes(c["cand"]))
    import struct
    a, b = [0.5, 0.25, 1.0, 0.0], [0.5, 0.375, 0.75, 0.0]
    f32 = [{"ref": a, "cand": b, "mask": None, "rmse": ss.f32_rmse(struct.pack("<4f", *a), struct.pack("<4f", *b))},
           {"ref": a, "cand": b, "mask": [1, 0, 1, 1],
            "rmse": ss.f32_rmse(struct.pack("<4f", *a), struct.pack("<4f", *b), bytes([1, 0, 1, 1]))},
           {"ref": a, "cand": b, "mask": [0, 0, 0, 0], "rmse": None}]
    ident = [{"ref": "a" * 64, "cand": "a" * 64, "out": "MATCH"}, {"ref": "a" * 64, "cand": "b" * 64, "out": "DRIFT"}]
    rounding = [{"in": x, "out": ss.round6(x)} for x in (82.3912345, 82.3912355, 15.9500004, -3.0103, 0.0000005)]
    return {"rule": "reconcile: identity and tolerance", "spec": "SPEC.md section 6",
            "identity": ident, "pcm_s16": pcm, "rgb8": rgb, "f32_rmse": f32, "round6": rounding}


# ------------------------------------------------------------------ receipt and scenes
def _base_receipts():
    scene = json.loads((ROOT / "examples/pixels/scene.json").read_text(encoding="utf-8"))
    sound = json.loads((ROOT / "examples/sound/sound.json").read_text(encoding="utf-8"))
    frame = bytes([10, 20, 30] * 4)
    ref = {"backend": "raw-native-cpu", "content_sha256": ss.sha256_hex(frame)}
    img = dict(producer="example-producer", version="0.1.0", backend="python-stdlib", scene=scene,
               media={"kind": "image", "width": 2, "height": 2, "format": "rgb8", "transfer": "srgb-u8"},
               content=frame, outputs={"frame.rgb": ss.sha256_hex(frame)}, reference=ref,
               reconcile=ss.reconcile_rgb8(frame, frame),
               does_not_prove=["One scene on one machine; other devices may drift."])
    pcm = ss.quantize_s16([0.0, 0.25, -0.25, 0.5])
    media = {"kind": "audio", "content": "speech", "rate": 48000, "channels": 1, "format": "s16le", "frames": 4,
             "duration_flicks": 4 * ss.flicks_per_sample(48000), "peak_dbfs": None, "integrated_lufs": None,
             "meter": ss.METER, "loudness_class": "speech", "loudness_verdict": "unverifiable",
             "access": {"autoplay": False, "captions": "vtt", "transcript": True, "reduced_sound": "silent"},
             "narration": {"backend": "qwen3-tts-local", "hosted": False, "model": "Qwen3-TTS-12Hz-1.7B",
                           "snapshot": "rev-pinned-example", "voice": "example-voice",
                           "text_sha256": ss.sha256_hex("Hello.".encode()), "reference": False,
                           "reproducible": False}}
    aud = dict(producer="example-narrator", version="0.1.0", backend="local-tts", scene=sound, media=media,
               content=pcm, outputs={"pcm.s16": ss.sha256_hex(pcm)},
               does_not_prove=["GPU sampling is not bit-exact, so a rerun can differ.",
                               "A PCM hash says nothing about how a device plays the sound."])
    return img, aud


def receipt_vectors():
    img, aud = _base_receipts()
    makes = []
    for kw in (img, aud):
        r = ss.make_receipt(**kw)
        args = {k: v for k, v in kw.items() if k != "content"}
        args["content_hex"] = kw["content"].hex()
        makes.append({"args": args, "receipt": r, "canonical": ss.canonical(r), "receipt_sha256": r["receipt_sha256"]})
    good_img, good_aud = makes[0]["receipt"], makes[1]["receipt"]

    def mut(base, fn, reseal=True):
        r = copy.deepcopy(base)
        fn(r)
        return ss.seal(r) if reseal else r

    def setp(path, val):
        def f(r):
            o = r
            for k in path[:-1]:
                o = o[k]
            o[path[-1]] = val
        return f

    def delp(path):
        def f(r):
            o = r
            for k in path[:-1]:
                o = o[k]
            del o[path[-1]]
        return f

    cases = [("valid image", good_img), ("valid audio", good_aud)]
    cases += [
        ("seal broken", mut(good_img, setp(["backend"], "other"), reseal=False)),
        ("schema", mut(good_img, setp(["schema"], "superstack.receipt/2"))),
        ("missing does_not_prove", mut(good_img, delp(["does_not_prove"]), reseal=False)),
        ("empty does_not_prove", mut(good_img, setp(["does_not_prove"], []))),
        ("blank does_not_prove", mut(good_img, setp(["does_not_prove"], [" \t\n"]))),
        ("float time", mut(good_img, setp(["time", "t"], 0.5))),
        ("wrong flick rate", mut(good_img, setp(["time", "per_second"], 1000))),
        ("seed_u32 wrong", mut(good_img, setp(["seed_u32"], 1))),
        ("unknown seed rule", mut(good_img, setp(["seed_rule"], "lcg/9"))),
        ("legacy seed rule unchecked", mut(good_img, lambda r: (r.update(seed_rule="fnv1a32-mulberry32", seed_u32=5)))),
        ("bad hex", mut(good_img, setp(["content_sha256"], "ABC"))),
        ("identity claims MATCH on drift", mut(good_img, setp(["reconcile", "reference", "content_sha256"], "0" * 64))),
        ("verdict word", mut(good_img, setp(["reconcile", "tolerance", "verdict"], "passed"))),
        ("unverifiable without reason", mut(good_img, setp(["reconcile", "tolerance", "verdict"], "unverifiable"))),
        ("media kind", mut(good_img, setp(["media", "kind"], "hologram"))),
        ("audio rate", mut(good_aud, setp(["media", "rate"], 44000))),
        ("audio duration", mut(good_aud, setp(["media", "duration_flicks"], 1))),
        ("audio format", mut(good_aud, setp(["media", "format"], "f32le"))),
        ("autoplay", mut(good_aud, setp(["media", "access", "autoplay"], True))),
        ("no reduced sound", mut(good_aud, delp(["media", "access", "reduced_sound"]))),
        ("speech without captions", mut(good_aud, setp(["media", "access", "captions"], None))),
        ("speech without transcript", mut(good_aud, setp(["media", "access", "transcript"], False))),
        ("music needs no captions", mut(good_aud, lambda r: (r["media"].update(content="music"),
                                                            r["media"]["access"].update(captions=None, transcript=False)))),
        ("narration as reference", mut(good_aud, setp(["media", "narration", "reference"], True))),
        ("narration missing voice", mut(good_aud, setp(["media", "narration", "voice"], ""))),
        ("hosted unpinned claims reproducible", mut(good_aud, lambda r: r["media"]["narration"].update(
            hosted=True, snapshot=None, reproducible=True))),
        ("hosted unpinned says so", mut(good_aud, lambda r: r["media"]["narration"].update(
            hosted=True, snapshot=None, reproducible=False))),
        ("hosted pinned", mut(good_aud, lambda r: r["media"]["narration"].update(
            hosted=True, backend="cartesia", model="sonic-3.6", snapshot="sonic-3.6-2026-08-27", reproducible=True))),
        ("no reconcile is fine", mut(good_img, setp(["reconcile"], None))),
        ("integral float time counts as integer", mut(good_img, setp(["time", "t"], 2.0))),
        ("bool is not a channel count", mut(good_aud, setp(["media", "channels"], True))),
        ("captions must be text", mut(good_aud, setp(["media", "access", "captions"], []))),
        ("reason must be text", mut(good_img, lambda r: r["reconcile"]["tolerance"].update(
            verdict="unverifiable", reason=["x"]))),
        ("narration must be an object", mut(good_aud, setp(["media", "narration"], "qwen"))),
        ("hosted with empty snapshot", mut(good_aud, lambda r: r["media"]["narration"].update(
            hosted=True, snapshot="", reproducible=True))),
        ("not an object", [1, 2]),
    ]
    verify = [{"name": n, "receipt": r, "errors": ss.verify_receipt(r)} for n, r in cases]
    return {"rule": "receipt superstack.receipt/1", "spec": "SPEC.md section 6", "make": makes, "verify": verify}


def scene_vectors():
    scene = json.loads((ROOT / "examples/pixels/scene.json").read_text(encoding="utf-8"))
    sound = json.loads((ROOT / "examples/sound/sound.json").read_text(encoding="utf-8"))
    hashes = [{"name": "proof pixel scene", "scene": scene, "sha256": ss.canonical_sha256(scene),
               "proof_recorded_prefix": "84aa884f"},
              {"name": "proof sound scene", "scene": sound, "sha256": ss.canonical_sha256(sound),
               "proof_recorded_prefix": "12ce2643"}]
    for h in hashes:
        assert h["sha256"].startswith(h["proof_recorded_prefix"]), h["name"]
    bad = [
        ("valid pixels", scene), ("valid sound", sound),
        ("kind", {**scene, "kind": "superstack.scene/9"}),
        ("seed not string", {**scene, "seed": 7}),
        ("float t", {**scene, "t_flicks": 1.5}),
        ("negative t", {**scene, "t_flicks": -1}),
        ("frame", {**scene, "frame": {"width": 0, "height": 256}}),
        ("rate", {**sound, "rate": 44000}),
        ("channels", {**sound, "channels": 6}),
        ("duration", {**sound, "duration_samples": 0}),
        ("bool channels", {**sound, "channels": True}),
        ("integral float rate", {**sound, "rate": 48000.0}),
        ("t beyond safe range", {**scene, "t_flicks": 2 ** 53}),
        ("not an object", "scene"),
    ]
    return {"rule": "scene IR", "spec": "SPEC.md section 2", "hashes": hashes,
            "validate": [{"name": n, "scene": s, "errors": ss.validate_scene(s)} for n, s in bad]}


BUILDERS = {"canonical": canonical_vectors, "hash": hash_vectors, "seed": seed_vectors, "clock": clock_vectors,
            "sound": sound_vectors, "export": export_vectors, "colour": colour_vectors,
            "reconcile": reconcile_vectors, "receipt": receipt_vectors, "scene": scene_vectors}


def render():
    files = {}
    for name, fn in BUILDERS.items():
        files[f"{name}.json"] = json.dumps(fn(), indent=1, ensure_ascii=False) + "\n"
    manifest = {"contract": ss.CONTRACT, "files": {k: hashlib.sha256(v.encode("utf-8")).hexdigest()
                                                     for k, v in sorted(files.items())}}
    files["MANIFEST.json"] = json.dumps(manifest, indent=1) + "\n"
    return files


def _close(a, b, path, worst):
    """Deep compare; floats may differ by 1e-12 relative (platform maths libraries)."""
    if isinstance(a, float) or isinstance(b, float):
        if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
            dev = abs(a - b) / max(1.0, abs(a), abs(b))
            worst[0] = max(worst[0], dev)
            return dev <= 1e-12 or [path]
        return [path]
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return [path]
        bad = []
        for k in a:
            r = _close(a[k], b[k], f"{path}.{k}", worst)
            bad += r if isinstance(r, list) else []
        return bad
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return [path]
        bad = []
        for i, (x, y) in enumerate(zip(a, b)):
            r = _close(x, y, f"{path}[{i}]", worst)
            bad += r if isinstance(r, list) else []
        return bad
    return [] if a == b and type(a) is type(b) else [path]


def check(files) -> int:
    """Exit status for --check. Exact text equality is expected on the platform
    that generated the files. Elsewhere, values computed through sin, tan, pow,
    cbrt or log10 may differ in the last bits, which the runners already allow
    for, so this compares values with a 1e-12 relative bound instead."""
    bad, worst = [], [0.0]
    for name, text in files.items():
        if name == "MANIFEST.json":
            continue
        p = VEC / name
        if not p.exists():
            bad.append(f"{name}: missing")
            continue
        disk = p.read_text(encoding="utf-8")
        if disk != text:
            bad += [f"{name}: {x}" for x in _close(json.loads(disk), json.loads(text), "$", worst)]
    manifest = json.loads((VEC / "MANIFEST.json").read_text(encoding="utf-8"))
    for name, digest in manifest["files"].items():
        if hashlib.sha256((VEC / name).read_bytes()).hexdigest() != digest:
            bad.append(f"MANIFEST.json: stale pin for {name}")
    if set(manifest["files"]) != {n for n in files if n != "MANIFEST.json"}:
        bad.append("MANIFEST.json: file list differs")
    for b in bad[:20]:
        print("DIFF", b)
    print(f"largest float deviation from the generator: {worst[0]:.3g}")
    print("vectors match the generator" if not bad else f"{len(bad)} differences")
    return 1 if bad else 0


def main():
    files = render()
    if "--check" in sys.argv:
        sys.exit(check(files))
    VEC.mkdir(exist_ok=True)
    for name, text in files.items():
        (VEC / name).write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {len(files)} files to {VEC}")


if __name__ == "__main__":
    main()
