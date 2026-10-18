"""Frame measurements of impact from a feel capture (tools/feel_capture.py): for each blow that lands
(Lamb's and the opponents'), and each catch, how the screen answers it.

    python game/engine/combat/tools/feel_measure.py <capture dir>

Per contact it reports:
  held     frames the struck body's picture stays still after contact (a box round it barely changes):
           the hit-stop as drawn, against the frames the simulation asked for (move hitstop)
  shake    the largest jitter of the whole plate in the 20 frames after contact, in screen pixels: the
           plate's frame-to-frame motion (phase correlation on a patch away from every body and every
           paper panel) less its 5-frame running mean, so the camera's smooth follow does not count
Also a noise floor: the same measures at quiet moments (no contact within 25 frames). Writes
measure.json beside capture.json and prints it. Reads frames/ and capture.json only.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image


def load(d, f):
    p = d / "frames" / f"f{f:05d}.png"
    return np.asarray(Image.open(p).convert("L"), dtype=np.float32) if p.exists() else None


def shift(a, b):
    A = np.fft.fft2(a - a.mean()); B = np.fft.fft2(b - b.mean()); R = A * np.conj(B); R /= np.abs(R) + 1e-9
    c = np.fft.ifft2(R).real; y, x = np.unravel_index(c.argmax(), c.shape)
    if y > c.shape[0] // 2: y -= c.shape[0]
    if x > c.shape[1] // 2: x -= c.shape[1]
    return int(x), int(y)


def scale(a, b):
    # the ratio of the patch's spread of edge energy (a crude zoom detector, enough to see a punch)
    ea = np.abs(np.diff(a, axis=1)).mean() + 1e-6; eb = np.abs(np.diff(b, axis=1)).mean() + 1e-6
    return abs(ea / eb - 1) * 100


def patch_away(track_f, W=1920, H=1080, size=(260, 180)):
    # a patch of plate at least 300 px from every body, away from the paper panels at the corners
    pts = [p for p in [track_f[0]] + track_f[1] if p]
    for y in range(220, 820 - size[1], 60):        # clear of the paper panels: clock, strip, talk offer, keys
        for x in range(340, 1500 - size[0], 60):
            if all(abs(x + size[0] / 2 - p[0]) > 300 or abs(y + size[1] / 2 - p[1]) > 300 for p in pts):
                return (slice(y, y + size[1]), slice(x, x + size[0]))
    return None


def measure(d, t, tf, body):
    box = patch_away(tf)
    span = list(range(t - 3, t + 21))
    frames = {f: load(d, f) for f in [span[0] - 1] + span}
    if not box or any(frames[f] is None for f in frames): return None
    # frame-to-frame plate motion on the far patch: the camera's smooth follow is taken out by a 5-frame
    # running mean, what is left is shake
    pos = [(0, 0)]
    for f in span: x, y = shift(frames[f][box], frames[f - 1][box]); pos.append((pos[-1][0] + x, pos[-1][1] + y))
    P = np.array(pos, dtype=float); K = np.ones(5) / 5
    sm = np.stack([np.convolve(np.pad(P[:, i], 2, mode="edge"), K, mode="valid") for i in (0, 1)], axis=1)
    sh = float(np.abs((P - sm)[3:]).max())
    # held: frames the body's box stays still after t, with the plate's motion taken out
    held = 0
    if body:
        bx = (slice(max(0, body[1] - 170), body[1] + 10), slice(max(0, body[0] - 60), body[0] + 60))
        for k in range(1, 20):
            a, b = frames.get(t + k - 1), frames.get(t + k)
            if a is None or b is None: break
            x, y = shift(b[box], a[box]); a2 = np.roll(a, (y, x), axis=(0, 1))
            if np.abs(b[bx] - a2[bx]).mean() > 1.5: break
            held += 1
    return {"held": held, "shake_px": round(sh, 1)}


def main():
    d = Path(sys.argv[1]); rec = json.loads((d / "capture.json").read_text(encoding="utf-8"))
    track = {f: (l, foes) for f, l, foes in rec["track"]}
    rows = []
    contacts = [e for e in rec["events"] if e["type"] in ("hit", "parry")]
    for e in contacts:
        t = e["t"]; tf = track.get(t)
        if not tf or not tf[0]: continue
        if e.get("id") == "lamb": body = tf[0]
        else:
            # an opponent: the track lists standing opponents in the fight's order; ids end in #n
            try: n = int(str(e.get("id")).rsplit("#", 1)[1]); body = tf[1][n] if n < len(tf[1]) else None
            except (IndexError, ValueError): body = None
        m = measure(d, t, tf, body)
        if m: rows.append({"t": t, "type": e["type"], "move": e.get("move"), "on": e.get("id"), **m})
    # the noise floor: the same measures at moments with no contact within 25 frames (Lamb's body)
    quiet = [f for f in sorted(track)[30:-30:37] if all(abs(f - c["t"]) > 25 for c in contacts) and track[f][0]]
    floor = [measure(d, f, track[f], track[f][0]) for f in quiet[:12]]
    floor = [x for x in floor if x]
    if floor:
        q = lambda k, p: round(float(np.percentile([x[k] for x in floor], p)), 1)
        rows.append({"floor": True, "n": len(floor), "shake_px_median": q("shake_px", 50), "shake_px_p90": q("shake_px", 90), "held_median": q("held", 50), "held_p90": q("held", 90)})
    (d / "measure.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    for r in rows: print(r)


if __name__ == "__main__":
    main()
