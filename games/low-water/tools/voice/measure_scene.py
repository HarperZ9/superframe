"""Voice prototype, step 3 (CPU): what can be measured about old against new, with instruments that share
no weights with the voice model (2026-10-03-voice/work/v2/evalkit.py: Whisper large-v3, WavLM-base-plus-sv).

    node tools/gpu-lock.mjs run "voice proto measure" -- python tools/voice/measure_scene.py OUTDIR --gpu
    (on the CPU, without --gpu, large-v3 took minutes a line while the machine was busy)

Per line (lines spoken over are skipped for speaker scores, since two voices share the window):
  wer       word error of a large-v3 transcript against the script text (normalised: case, punctuation)
  speaker   WavLM-SV cosine between every pair of speakers' mean embeddings, old and new: in the old
            mix every speaker is one voice, so pairs sit near 1; distinct casting should pull them apart
Not measured: whether any voice sounds natural, in character, or good. Only listening settles that.
Writes OUTDIR/measure.json.
"""
import json, os, re, sys, tempfile
from pathlib import Path
import numpy as np, soundfile as sf

sys.path.insert(0, os.environ["LW_VOICE_EVALKIT"])  # the in-house evalkit (ASR, SV)
from evalkit import ASR, SV  # noqa: E402

NUM = {"eighteen": "18", "twenty-five": "25", "twenty-four": "24", "sixty": "60", "four": "4", "five": "5", "ten": "10", "eleven": "11"}


def norm(s):
    s = s.lower().replace("-", " ")
    s = re.sub(r"[^a-z0-9' ]", " ", s)
    return [NUM.get(w, w) for w in s.split()]


def wer(ref, hyp):
    r, h = norm(ref), norm(hyp)
    d = np.arange(len(h) + 1)
    for i in range(1, len(r) + 1):
        prev, d[0] = d.copy(), i
        for j in range(1, len(h) + 1):
            d[j] = min(prev[j] + 1, d[j - 1] + 1, prev[j - 1] + (r[i - 1] != h[j - 1]))
    return int(d[len(h)]), len(r)


def main():
    out = Path(sys.argv[1])
    tl = json.loads((out / "timeline.json").read_text(encoding="utf-8"))
    dev = "cuda" if "--gpu" in sys.argv else "cpu"
    asr, sv = ASR(dev), SV(dev)
    res = {"lines": [], "speaker_pairs": {}}
    emb = {"old": {}, "new": {}}
    over_next = {i for i, L in enumerate(tl["lines"]) if i + 1 < len(tl["lines"]) and tl["lines"][i + 1]["dir"].get("over")}
    with tempfile.TemporaryDirectory() as td:
        for mix, rows in (("old", tl["old_lines"]), ("new", tl["lines"])):
            y, sr = sf.read(str(out / f"{mix}.wav"), dtype="float32", always_2d=True)
            y = y.mean(axis=1)
            for r in rows:
                L = tl["lines"][r["line"]]
                seg = y[int(r["start"] * sr): int(r["end"] * sr) + int(0.05 * sr)]
                f = Path(td) / f"{mix}{r['line']}.wav"; sf.write(str(f), seg, sr)
                e, n = wer(L["text"], hyp := asr(f))
                row = {"mix": mix, "line": r["line"], "who": L["who"], "errors": e, "words": n, "heard": hyp}
                res["lines"].append(row); print(json.dumps(row), flush=True)
                overlapped = r["line"] in over_next or L["dir"].get("over")
                if not overlapped and len(seg) > sr * 1.0:
                    emb[mix].setdefault(L["who"], []).append(sv(f))
    for mix in ("old", "new"):
        cent = {k: (lambda m: m / np.linalg.norm(m))(np.mean(v, axis=0)) for k, v in emb[mix].items()}
        keys = sorted(cent)
        res["speaker_pairs"][mix] = {f"{a}~{b}": round(float(cent[a] @ cent[b]), 3) for i, a in enumerate(keys) for b in keys[i + 1:]}
    for mix in ("old", "new"):
        rows = [r for r in res["lines"] if r["mix"] == mix]
        res[f"wer_{mix}"] = {"errors": sum(r["errors"] for r in rows), "words": sum(r["words"] for r in rows)}
    (out / "measure.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(json.dumps({k: res[k] for k in ("wer_old", "wer_new", "speaker_pairs")}, indent=1))


if __name__ == "__main__":
    main()
