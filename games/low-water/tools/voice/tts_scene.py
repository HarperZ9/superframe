"""Voice prototype, step 1 (GPU): speak every text segment of a scene script with the author's own
fine-tuned voice (design/VOICE-BIBLE.md section 7). Source: the checkpoint at LW_VOICE_MODEL,
a LoRA of Qwen3-TTS-12Hz-1.7B-Base (Apache-2.0) trained only on the author's own recordings
(the voice manifest kept with the checkpoint). Local only; no network, no other voice.

    node tools/gpu-lock.mjs run "voice proto tts" -- python tools/voice/tts_scene.py SCRIPT.json [--seed-bump K] [--ids L03s0,L07s1]

Each spoken segment between cues is spoken separately, so pauses, breaths and overlaps are placed by the
mixer, not left to the model. The old and the new mix (mix_scene.py) use the same takes, so the
difference a listener hears is the method, not a luckier sample. Batched, BATCH texts per call, one
seed per batch. Generation settings are the narration pipeline's (2026-10-03-voice/work/v3/synth_ab.py).
Output: LW_VOICE_OUT/new/<id>.wav (24 kHz float, private) and tts.json.
"""
import gc, hashlib, json, os, pathlib, sys, time
import numpy as np, soundfile as sf, torch

MODEL = os.environ["LW_VOICE_MODEL"]  # the private fine-tune checkpoint; never in the repository
OUT = pathlib.Path(os.environ["LW_VOICE_OUT"])  # a private folder outside the repository
BATCH = 8
GEN = dict(do_sample=True, temperature=0.9, top_k=50, top_p=1.0, repetition_penalty=1.05,
           subtalker_dosample=True, subtalker_temperature=0.9, subtalker_top_k=50, subtalker_top_p=1.0)


def xmur3(s):
    h = 1779033703 ^ len(s)
    for ch in s:
        h = ((h ^ ord(ch)) * 3432918353) & 0xFFFFFFFF
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF
    h = ((h ^ (h >> 16)) * 2246822507) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 3266489909) & 0xFFFFFFFF
    return (h ^ (h >> 16)) & 0xFFFFFFFF


def items(script):
    out = []
    for i, L in enumerate(script["lines"]):
        k = 0
        for seg in L["spoken"]:
            if "say" in seg:
                out.append(("new", f"L{i:02d}s{k}", seg["say"])); k += 1
    return out


def main():
    args = sys.argv[1:]
    script = json.load(open(args[0], encoding="utf-8"))
    bump = int(args[args.index("--seed-bump") + 1]) if "--seed-bump" in args else 0
    ids = set(args[args.index("--ids") + 1].split(",")) if "--ids" in args else None
    todo = [it for it in items(script) if not ids or it[1] in ids]
    OUT.mkdir(parents=True, exist_ok=True)
    man_p = OUT / "tts.json"
    man = json.load(open(man_p, encoding="utf-8")) if man_p.exists() else {"model": MODEL, "settings": GEN, "renders": {}}
    from qwen_tts import Qwen3TTSModel
    t0 = time.time()
    m = Qwen3TTSModel.from_pretrained(MODEL, device_map="cuda:0", dtype=torch.bfloat16, attn_implementation="sdpa")
    try:
        for b in range(0, len(todo), BATCH):
            chunk = todo[b:b + BATCH]
            seed = f"lw-voice-20261021/batch/{chunk[0][1]}/{bump}"
            s32 = xmur3(seed)
            torch.manual_seed(s32); torch.cuda.manual_seed_all(s32); np.random.seed(s32)
            mnt = min(2048, 15 * max(len(t.split()) for _, _, t in chunk) + 60)
            wavs, sr = m.generate_custom_voice(text=[t for _, _, t in chunk], speaker=["author"] * len(chunk),
                                               language=["Auto"] * len(chunk), max_new_tokens=mnt, **GEN)
            for (kind, slug, text), w in zip(chunk, wavs):
                y = np.asarray(w, dtype=np.float32)
                d = OUT / kind; d.mkdir(parents=True, exist_ok=True)
                f = d / f"{slug}.wav"
                sf.write(str(f), y, sr, subtype="FLOAT")
                secs = len(y) / sr
                man["renders"][f"{kind}/{slug}"] = {"text": text, "seed": seed, "sr": sr, "seconds": round(secs, 3), "max_new_tokens": mnt,
                                                    "hit_cap": secs >= mnt / 12.5 - 0.2, "sha256": hashlib.sha256(f.read_bytes()).hexdigest()}
                print(kind, slug, round(secs, 2), text[:50], flush=True)
            print("batch", b // BATCH, "wall", round(time.time() - t0, 1), flush=True)
    finally:
        del m; gc.collect(); torch.cuda.empty_cache()
        json.dump(man, open(man_p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("wall", round(time.time() - t0, 1), "items", len(todo), flush=True)


if __name__ == "__main__":
    main()
