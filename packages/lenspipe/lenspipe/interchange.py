# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Text interchange: Zemax ZMX, CODE V .seq, Lens Room JSON, and our own readers for each.

ZMX and SEQ keywords were read from public open-source parsers and docs (rayoptics zmxread, RayTracing ZMXReader, Optiland).
Neither commercial tool is available here. rayoptics reads both files in the tests; OpticStudio and CODE V never did.
"""
import copy
import re
from pathlib import Path

from .design import SCHEMA, to_lens


def _g(x):
    return repr(float(x))


def to_zmx(d):
    it = d["intent"]
    wl = it["wavelengths_nm"]
    wts = it.get("weights", [1] * len(wl))
    fields = it["half_field_deg"]
    L = [f"VERS 200000 0 0", "MODE SEQ", f"NAME {d['id']}", "UNIT MM X W X CM MR CPMM"]
    L.append(f"ENPD {_g(_entrance_diameter(d))}")
    L.append(f"FTYP 0 0 {len(fields)} {len(wl)} 0 0 0")
    L.append("XFLN " + " ".join("0" for _ in fields))
    L.append("YFLN " + " ".join(_g(f) for f in fields))
    L.append("FWGN " + " ".join("1" for _ in fields))
    for i, (w, q) in enumerate(zip(wl, wts), 1):
        L.append(f"WAVM {i} {_g(w * 1e-3)} {_g(q)}")
    L.append(f"PWAV {int(it.get('primary', len(wl) // 2)) + 1}")
    L += ["SURF 0", "  TYPE STANDARD", "  CURV 0.0 0 0 0 0", "  DISZ INFINITY", "  DIAM 0 0 0 0 1"]
    for i, s in enumerate(d["surfaces"], 1):
        asp = s.get("aspheric") or []
        L.append(f"SURF {i}")
        if s.get("stop"):
            L.append("  STOP")
        L.append("  TYPE " + ("EVENASPH" if asp else "STANDARD"))
        L.append(f"  CURV {_g(0.0 if s['r'] is None else 1.0 / s['r'])} 0 0 0 0")
        L.append(f"  DISZ {_g(s['t'])}")
        m = s.get("material")
        if isinstance(m, dict):
            L.append(f"  GLAS ___BLANK 1 0 {_g(m['nd'])} {_g(m['vd'])} 0 0 0 0 0 0")
        elif m not in (None, "air"):
            L.append(f"  GLAS {m} 0 0 1.5 40 0 0 0 0 0 0")
        if s.get("conic"):
            L.append(f"  CONI {_g(s['conic'])}")
        for j, a in enumerate(asp):
            L.append(f"  PARM {j + 2} {_g(a)}")   # PARM 1 is the r^2 term, left at zero
        L.append(f"  DIAM {_g(s['semi'])} 1 0 0 1")
    n = len(d["surfaces"]) + 1
    L += [f"SURF {n}", "  TYPE STANDARD", "  CURV 0.0 0 0 0 0", "  DISZ 0", "  DIAM 0 0 0 0 1"]
    return "\n".join(L) + "\n"


def _entrance_diameter(d):
    from .trace import paraxial
    lens = to_lens(d)
    efl = float(abs(paraxial(lens)[0].real))
    return efl / d["intent"]["fno"]


def write_zmx(d, path):
    Path(path).write_text(to_zmx(d), encoding="utf-16")


def read_zmx(path, base=None):
    """Our reader. base: a design to take intent and tolerances from, since ZMX does not carry ours."""
    raw = Path(path).read_bytes()
    txt = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8", "replace")
    surfs, cur, wl, wts, yf, fno_epd = [], None, [], [], [], None
    for line in txt.splitlines():
        t = line.split()
        if not t:
            continue
        key = t[0]
        if key == "SURF":
            cur = dict(_i=int(t[1]))
            surfs.append(cur)
        elif key == "WAVM":
            wl.append(float(t[2]) * 1e3); wts.append(float(t[3]))
        elif key == "YFLN":
            yf = [float(x) for x in t[1:]]
        elif key == "ENPD":
            fno_epd = float(t[1])
        elif cur is not None:
            if key == "STOP":
                cur["stop"] = True
            elif key == "CURV":
                c = float(t[1]); cur["r"] = None if c == 0 else 1.0 / c
            elif key == "DISZ":
                cur["t"] = float("inf") if t[1] == "INFINITY" else float(t[1])
            elif key == "GLAS":
                cur["material"] = dict(nd=float(t[4]), vd=float(t[5])) if t[1] == "___BLANK" else t[1]
            elif key == "CONI":
                cur["conic"] = float(t[1])
            elif key == "PARM":
                j = int(t[1]) - 2
                if j >= 0:
                    a = cur.setdefault("aspheric", [])
                    a += [0.0] * (j + 1 - len(a))
                    a[j] = float(t[2])
            elif key == "DIAM":
                cur["semi"] = float(t[1])
    body = surfs[1:-1]
    for s in body:
        s.pop("_i")
    out = dict(schema=SCHEMA, id=(base or {}).get("id", "from-zmx"), units="mm", surfaces=body,
               intent=copy.deepcopy((base or {}).get("intent", dict(fno=1.0, half_field_deg=yf, wavelengths_nm=wl, weights=wts))))
    out["_epd"] = fno_epd
    if base and "tolerances" in base:
        out["tolerances"] = copy.deepcopy(base["tolerances"])
    return out


def _seq_glass(m):
    if isinstance(m, dict):
        return f"{m['nd']:.6f}:{m['vd']:.4f}"
    return m


def to_seq(d):
    it = d["intent"]
    wl = it["wavelengths_nm"]
    L = ["RDM;LEN", f"TITLE '{d['id']}'", f"EPD {_g(_entrance_diameter(d))}", "DIM M",
         "WL " + " ".join(_g(w) for w in wl), f"REF {int(it.get('primary', len(wl) // 2)) + 1}",
         "WTW " + " ".join("1" for _ in wl), "XAN " + " ".join("0" for _ in it["half_field_deg"]),
         "YAN " + " ".join(_g(f) for f in it["half_field_deg"]), "WTF " + " ".join("1" for _ in it["half_field_deg"]),
         "SO 0.0 1e+11"]
    for s in d["surfaces"]:
        r = 0.0 if s["r"] is None else s["r"]
        m = s.get("material")
        head = f"S {_g(r)} {_g(s['t'])}" + ("" if m in (None, "air") else f" {_seq_glass(m)}")
        L.append(head)
        if s.get("stop"):
            L.append("  STO")
        L.append(f"  CIR {_g(s['semi'])}")
        if s.get("aspheric") or s.get("conic"):
            L.append("  ASP")
            L.append(f"  K {_g(s.get('conic', 0.0))}")
            names = "A B C D E F G H".split()
            terms = "; ".join(f"{names[j]} {_g(a)}" for j, a in enumerate(s.get("aspheric", [])))
            if terms:
                L.append("  " + terms)
    L += ["SI 0.0 0.0", "GO"]
    return "\n".join(L) + "\n"


def write_seq(d, path):
    Path(path).write_text(to_seq(d), encoding="utf-8", newline="\n")


def read_seq(path, base=None):
    surfs, cur = [], None
    names = "ABCDEFGH"
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        for part in raw.split(";"):
            t = part.split()
            if not t:
                continue
            k = t[0].upper()
            if k == "S":
                r = float(t[1])
                cur = dict(r=None if r == 0 else r, t=float(t[2]))
                if len(t) > 3:
                    g = t[3]
                    if ":" in g:
                        nd, vd = g.split(":")
                        cur["material"] = dict(nd=float(nd), vd=float(vd))
                    else:
                        cur["material"] = g
                surfs.append(cur)
            elif k == "SI":
                cur = None
            elif cur is None:
                continue
            elif k == "STO":
                cur["stop"] = True
            elif k == "CIR":
                cur["semi"] = float(t[1])
            elif k == "K":
                v = float(t[1])
                if v:
                    cur["conic"] = v
            elif k in names and len(t) == 2:
                j = names.index(k)
                a = cur.setdefault("aspheric", [])
                a += [0.0] * (j + 1 - len(a))
                a[j] = float(t[1])
    out = dict(schema=SCHEMA, id=(base or {}).get("id", "from-seq"), units="mm", surfaces=surfs, intent=copy.deepcopy((base or {}).get("intent", {})))
    if base and "tolerances" in base:
        out["tolerances"] = copy.deepcopy(base["tolerances"])
    return out


def to_lens_room(d):
    """Train surfaces in the form lens-room.html states at its prescription table: z, y, R, k, a4, a6, n, V, ap, hole, ty, tilt."""
    from . import glass
    z, rows = 0.0, []
    prim = d["intent"]["wavelengths_nm"][d["intent"].get("primary", 1)]
    for s in d["surfaces"]:
        m = s.get("material")
        n = glass.index(m, prim) if m not in (None, "air") else 1.0
        if isinstance(m, dict):
            V = m["vd"]
        elif m in (None, "air"):
            V = 0.0
        else:
            V = glass.catalog()[m]["vd"]
        a = (s.get("aspheric") or []) + [0.0, 0.0]
        rows.append(dict(z=z, y=0.0, R=0.0 if s["r"] is None else s["r"], k=s.get("conic", 0.0), a4=a[0], a6=a[1], n=n, V=V, ap=s["semi"], hole=0.0, ty=2 if s.get("stop") else 0, tilt=0.0))
        z += s["t"]
    rows.append(dict(z=z, y=0.0, R=0.0, k=0.0, a4=0.0, a6=0.0, n=1.0, V=0.0, ap=max(s["semi"] for s in d["surfaces"]), hole=0.0, ty=3, tilt=0.0))
    return dict(format="lens-room-train/1", id=d["id"], note="field layout read from lens-room.html comment; the room has not loaded this file", surfaces=rows)


def from_lens_room(j, base):
    """Reverse: the room holds index and Abbe, so names are lost. Only geometry and nd, V come back."""
    out = copy.deepcopy(base)
    rows = [r for r in j["surfaces"] if r["ty"] != 3]
    out["surfaces"] = []
    for a, b in zip(rows, rows[1:] + [j["surfaces"][-1]]):
        s = dict(r=None if a["R"] == 0 else a["R"], t=b["z"] - a["z"], semi=a["ap"], material=None if a["n"] == 1.0 else dict(n_primary=a["n"], vd=a["V"]))
        if a["k"]:
            s["conic"] = a["k"]
        if a["a4"] or a["a6"]:
            s["aspheric"] = [a["a4"], a["a6"]]
        if a["ty"] == 2:
            s["stop"] = True
        out["surfaces"].append(s)
    return out


def compare(a, b, tol=1e-9):
    """Surface-by-surface differences between two design dicts. Returns the worst relative difference and every miss."""
    misses, worst = [], 0.0
    if len(a["surfaces"]) != len(b["surfaces"]):
        return float("inf"), [f"surface count {len(a['surfaces'])} against {len(b['surfaces'])}"]
    for i, (x, y) in enumerate(zip(a["surfaces"], b["surfaces"])):
        for k in ("r", "t", "semi", "conic"):
            u, v = x.get(k), y.get(k)
            if k == "conic":
                u, v = u or 0.0, v or 0.0
            if (u is None) != (v is None):
                misses.append(f"S{i+1} {k}: {u} against {v}")
                continue
            if u is None:
                continue
            e = abs(u - v) / max(abs(u), 1e-12) if u else abs(v)
            worst = max(worst, e)
            if e > tol:
                misses.append(f"S{i+1} {k}: {u} against {v}")
        ax, ay = x.get("aspheric") or [], y.get("aspheric") or []
        for j in range(max(len(ax), len(ay))):
            u = ax[j] if j < len(ax) else 0.0
            v = ay[j] if j < len(ay) else 0.0
            e = abs(u - v) / max(abs(u), 1e-30) if u else abs(v)
            worst = max(worst, e)
            if e > tol:
                misses.append(f"S{i+1} a{j}: {u} against {v}")
        ma, mb = x.get("material"), y.get("material")
        ma, mb = None if ma == "air" else ma, None if mb == "air" else mb
        if isinstance(ma, dict) and isinstance(mb, dict):
            for k in ("nd", "vd"):
                if abs(ma[k] - mb[k]) > 1e-3 * 0 + tol * max(abs(ma[k]), 1):
                    misses.append(f"S{i+1} {k}: {ma[k]} against {mb[k]}")
        elif ma != mb:
            misses.append(f"S{i+1} material: {ma} against {mb}")
        if bool(x.get("stop")) != bool(y.get("stop")):
            misses.append(f"S{i+1} stop flag differs")
    return worst, misses


_FIELD = re.compile(r"^(\d+)/(.*)$")


def parse_iso_codes(text):
    """Pull ISO 10110 indications back out of the drawing's text block: code to string."""
    out = {}
    for line in text.splitlines():
        m = _FIELD.match(line.strip())
        if m:
            out[int(m.group(1))] = m.group(2)
    return out
