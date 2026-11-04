# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Mechanical outputs: STEP AP214 solids, binary glTF, ISO 10110 element drawing as SVG and text. Standard library plus numpy.

The drawing uses the notation as public tutorials give it (0/ 1/ 2/ 3/ 4/ 5/). I did not buy ISO 10110 and no shop read these.
"""
import json
import math
import struct
from pathlib import Path

import numpy as np

from . import design
from .rules import sag


def pieces(d):
    """Every solid glass piece: (surface a, surface b, z of a, material)."""
    z, out, s = 0.0, [], d["surfaces"]
    for i, x in enumerate(s):
        if x.get("material") not in (None, "air") and i + 1 < len(s):
            out.append((i, i + 1, z, x.get("material")))
        z += x["t"]
    return out


def mech_radius(d, a, b):
    return max(d["surfaces"][a]["semi"], d["surfaces"][b]["semi"])


# ---------------------------------------------------------------------------- STEP
class _Step:
    def __init__(self):
        self.ents = []

    def add(self, s):
        self.ents.append(s)
        return f"#{len(self.ents)}"

    def pt(self, x, y, z):
        return self.add(f"CARTESIAN_POINT('',({x!r},{y!r},{z!r}))")

    def dir(self, x, y, z):
        return self.add(f"DIRECTION('',({float(x)!r},{float(y)!r},{float(z)!r}))")

    def axis(self, z):
        return self.add(f"AXIS2_PLACEMENT_3D('',{self.pt(0.0, 0.0, float(z))},{self.dir(0, 0, 1)},{self.dir(1, 0, 0)})")


def _surface(st, s, zv, rm):
    r = s["r"]
    if s.get("aspheric") or s.get("conic"):
        hs = np.linspace(0, rm, 33)
        pts = ",".join(st.pt(float(h), 0.0, float(zv + sag(s, float(h)))) for h in hs)
        n = len(hs)
        knots = ",".join(str(float(i)) for i in range(n - 2))
        mult = ",".join(["4"] + ["1"] * (n - 4) + ["4"])
        curve = st.add(f"B_SPLINE_CURVE_WITH_KNOTS('',3,({pts}),.UNSPECIFIED.,.F.,.F.,({mult}),({knots}),.UNSPECIFIED.)")
        ax = st.add(f"AXIS1_PLACEMENT('',{st.pt(0.0, 0.0, 0.0)},{st.dir(0, 0, 1)})")
        return st.add(f"SURFACE_OF_REVOLUTION('',{curve},{ax})"), None
    if r is None:
        return st.add(f"PLANE('',{st.axis(zv)})"), "plane"
    return st.add(f"SPHERICAL_SURFACE('',{st.axis(zv + r)},{abs(float(r))!r})"), "sphere"


def _solid(st, d, a, b, z0):
    A, B = d["surfaces"][a], d["surfaces"][b]
    rm = mech_radius(d, a, b)
    z1 = z0 + A["t"]
    zf, zb = z0 + sag(A, rm), z1 + sag(B, rm)
    if not (math.isfinite(zf) and math.isfinite(zb)) or zb <= zf:
        raise ValueError(f"piece S{a+1}-S{b+1}: no valid edge at radius {rm}")
    vf0, vf1 = st.add(f"VERTEX_POINT('',{st.pt(rm, 0.0, zf)})"), st.add(f"VERTEX_POINT('',{st.pt(-rm, 0.0, zf)})")
    vb0, vb1 = st.add(f"VERTEX_POINT('',{st.pt(rm, 0.0, zb)})"), st.add(f"VERTEX_POINT('',{st.pt(-rm, 0.0, zb)})")
    cf = st.add(f"CIRCLE('',{st.axis(zf)},{rm!r})")
    cb = st.add(f"CIRCLE('',{st.axis(zb)},{rm!r})")
    ef0 = st.add(f"EDGE_CURVE('',{vf0},{vf1},{cf},.T.)")
    ef1 = st.add(f"EDGE_CURVE('',{vf1},{vf0},{cf},.T.)")
    eb0 = st.add(f"EDGE_CURVE('',{vb0},{vb1},{cb},.T.)")
    eb1 = st.add(f"EDGE_CURVE('',{vb1},{vb0},{cb},.T.)")

    def line(x):
        lp = st.add(f"LINE('',{st.pt(x, 0.0, zf)},{st.add(f'VECTOR({chr(39)}{chr(39)},{st.dir(0, 0, 1)},1.0)')})")
        v0, v1 = (vf0, vb0) if x > 0 else (vf1, vb1)
        return st.add(f"EDGE_CURVE('',{v0},{v1},{lp},.T.)")
    l0, l1 = line(rm), line(-rm)

    def oe(e, sense):
        return st.add(f"ORIENTED_EDGE('',*,*,{e},{'.T.' if sense else '.F.'})")

    def face(loop, surf, same):
        lp = st.add(f"EDGE_LOOP('',({','.join(loop)}))")
        bd = st.add(f"FACE_OUTER_BOUND('',{lp},.T.)")
        return st.add(f"ADVANCED_FACE('',({bd}),{surf},{'.T.' if same else '.F.'})")

    sf, kf = _surface(st, A, z0, rm)
    sb, kb = _surface(st, B, z1, rm)
    # Outward normal of the solid at the front is towards -z; at the back towards +z.
    same_f = {"plane": False, "sphere": (A["r"] or 1) > 0, None: False}[kf]
    same_b = {"plane": True, "sphere": (B["r"] or 1) < 0, None: True}[kb]
    front = face([oe(ef1, False), oe(ef0, False)], sf, same_f)
    back = face([oe(eb0, True), oe(eb1, True)], sb, same_b)
    cyl = st.add(f"CYLINDRICAL_SURFACE('',{st.axis(zf)},{rm!r})")
    side0 = face([oe(ef0, True), oe(l1, True), oe(eb0, False), oe(l0, False)], cyl, True)
    side1 = face([oe(ef1, True), oe(l0, True), oe(eb1, False), oe(l1, False)], cyl, True)
    shell = st.add(f"CLOSED_SHELL('',({front},{back},{side0},{side1}))")
    return st.add(f"MANIFOLD_SOLID_BREP('S{a+1}-S{b+1}',{shell})")


def write_step(d, path):
    st = _Step()
    solids = [_solid(st, d, a, b, z) for a, b, z, _ in pieces(d)]
    ctx = st.add("APPLICATION_CONTEXT('automotive design')")
    st.add(f"APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,{ctx})")
    mctx = st.add(f"MECHANICAL_CONTEXT('',{ctx},'mechanical')")
    pdctx = st.add(f"DESIGN_CONTEXT('',{ctx},'design')")
    prod = st.add(f"PRODUCT('{d['id']}','{d['id']}','',({mctx}))")
    form = st.add(f"PRODUCT_DEFINITION_FORMATION('','',{prod})")
    pdef = st.add(f"PRODUCT_DEFINITION('design','',{form},{pdctx})")
    pds = st.add(f"PRODUCT_DEFINITION_SHAPE('','',{pdef})")
    lu = st.add("( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )")
    au = st.add("( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )")
    su = st.add("( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )")
    unc = st.add(f"UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),{lu},'distance_accuracy_value','confusion accuracy')")
    gc = st.add(f"( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT(({unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT(({lu},{au},{su})) REPRESENTATION_CONTEXT('','') )")
    origin = st.axis(0.0)
    rep = st.add(f"ADVANCED_BREP_SHAPE_REPRESENTATION('',({','.join(solids)},{origin}),{gc})")
    st.add(f"SHAPE_DEFINITION_REPRESENTATION({pds},{rep})")
    head = ("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('lenspipe optical elements'),'2;1');\n"
            f"FILE_NAME('{d['id']}.step','2026-10-31T00:00:00',(''),(''),'lenspipe','lenspipe','');\n"
            "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));\nENDSEC;\nDATA;\n")
    body = "\n".join(f"#{i+1}={e};" for i, e in enumerate(st.ents))
    Path(path).write_text(head + body + "\nENDSEC;\nEND-ISO-10303-21;\n", encoding="ascii")
    return len(solids)


def analytic_volume(d):
    """Volume of each piece by integrating sag difference; the STEP check compares against this."""
    out = []
    for a, b, z, _ in pieces(d):
        A, B = d["surfaces"][a], d["surfaces"][b]
        rm = mech_radius(d, a, b)
        hs = np.linspace(0, rm, 4001)
        th = np.array([A["t"] + sag(B, float(h)) - sag(A, float(h)) for h in hs])
        out.append(float(np.trapezoid(2 * np.pi * hs * th, hs)))
    return out


# ---------------------------------------------------------------------------- glTF
def _lathe(d, a, b, z0, seg=64, rings=24):
    A, B = d["surfaces"][a], d["surfaces"][b]
    rm = mech_radius(d, a, b)
    prof = [(float(h), z0 + sag(A, float(h))) for h in np.linspace(0, rm, rings)]
    prof += [(float(h), z0 + A["t"] + sag(B, float(h))) for h in np.linspace(rm, 0, rings)]
    pts, idx = [], []
    for r, z in prof:
        for k in range(seg):
            th = 2 * np.pi * k / seg
            pts.append((r * np.cos(th), r * np.sin(th), z))
    for j in range(len(prof) - 1):
        for k in range(seg):
            p, q = j * seg + k, j * seg + (k + 1) % seg
            u, v = p + seg, q + seg
            idx += [p, u, q, q, u, v]
    return np.array(pts, np.float32) * 1e-3, np.array(idx, np.uint32)


def write_glb(d, path):
    """One mesh per glass piece, metres, KHR_materials_transmission with the glass's nd as ior."""
    from . import glass as G
    buf, views, accs, meshes, nodes, mats = b"", [], [], [], [], []
    for pi, (a, b, z, m) in enumerate(pieces(d)):
        v, ix = _lathe(d, a, b, z)
        for arr, tgt, ctype, typ, cnt in ((v, 34962, 5126, "VEC3", len(v)), (ix, 34963, 5125, "SCALAR", len(ix))):
            raw = arr.tobytes()
            views.append(dict(buffer=0, byteOffset=len(buf), byteLength=len(raw), target=tgt))
            acc = dict(bufferView=len(views) - 1, componentType=ctype, count=cnt, type=typ)
            if typ == "VEC3":
                acc.update(min=[float(x) for x in v.min(0)], max=[float(x) for x in v.max(0)])
            accs.append(acc)
            buf += raw + b"\0" * ((4 - len(raw) % 4) % 4)
        nd = G.index(m, 587.5618)
        mats.append(dict(name=str(m) if isinstance(m, str) else f"nd{nd:.4f}", pbrMetallicRoughness=dict(baseColorFactor=[0.85, 0.92, 1.0, 1.0], metallicFactor=0.0, roughnessFactor=0.05),
                         extensions=dict(KHR_materials_transmission=dict(transmissionFactor=1.0), KHR_materials_ior=dict(ior=nd))))
        meshes.append(dict(name=f"S{a+1}-S{b+1}", primitives=[dict(attributes=dict(POSITION=len(accs) - 2), indices=len(accs) - 1, material=pi)]))
        nodes.append(dict(mesh=pi, name=f"S{a+1}-S{b+1}"))
    gltf = dict(asset=dict(version="2.0", generator="lenspipe"), extensionsUsed=["KHR_materials_transmission", "KHR_materials_ior"], scene=0,
                scenes=[dict(nodes=list(range(len(nodes))))], nodes=nodes, meshes=meshes, materials=mats, accessors=accs, bufferViews=views, buffers=[dict(byteLength=len(buf))])
    j = json.dumps(gltf).encode()
    j += b" " * ((4 - len(j) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(buf)
    Path(path).write_bytes(struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(j), 0x4E4F534A) + j + struct.pack("<II", len(buf), 0x004E4942) + buf)


def read_glb(path):
    """Parse a GLB we wrote; returns per-mesh bounds in mm from the raw vertex buffer, never from the accessor min and max."""
    raw = Path(path).read_bytes()
    magic, ver, total = struct.unpack("<III", raw[:12])
    if magic != 0x46546C67 or total != len(raw):
        raise ValueError("bad GLB header")
    jl, _ = struct.unpack("<II", raw[12:20])
    g = json.loads(raw[20:20 + jl])
    bin_start = 20 + jl + 8
    out = []
    for m in g["meshes"]:
        acc = g["accessors"][m["primitives"][0]["attributes"]["POSITION"]]
        bv = g["bufferViews"][acc["bufferView"]]
        v = np.frombuffer(raw, np.float32, acc["count"] * 3, bin_start + bv["byteOffset"]).reshape(-1, 3) * 1e3
        out.append(dict(name=m["name"], rmax=float(np.hypot(v[:, 0], v[:, 1]).max()), zmin=float(v[:, 2].min()), zmax=float(v[:, 2].max())))
    return out


# ---------------------------------------------------------------------------- ISO 10110
def iso_codes(d, a, b):
    """Text block for one piece. 3/A(B/C): A power fringes, B irregularity; 4/ tilt in arcminutes; both at 632.8 nm."""
    ta, tb = design.tolerances(d, a), design.tolerances(d, b)
    extra = d.get("tolerances", {}).get("material", {})
    return {
        "0": extra.get("stress", "0/20"), "1": extra.get("bubbles", "1/3x0.25"), "2": extra.get("inclusions", "2/2;1"),
        "S1": dict(form=f"3/{ta['power_fringes']:g}({ta['irreg_fringes']:g}/-)", center=f"4/{ta['tilt_arcmin']:g}'", imp=extra.get("imperfections", "5/3x0.16")),
        "S2": dict(form=f"3/{tb['power_fringes']:g}({tb['irreg_fringes']:g}/-)", center=f"4/{tb['tilt_arcmin']:g}'", imp=extra.get("imperfections", "5/3x0.16")),
    }


def drawing(d, a, b, path_stem):
    """Writes a .svg section view and a .txt block for one element; returns the data dict the two share."""
    from . import glass as G
    A, B = d["surfaces"][a], d["surfaces"][b]
    m = A.get("material")
    rm = mech_radius(d, a, b)
    tol = design.tolerances(d, a)
    codes = iso_codes(d, a, b)
    nd = G.index(m, 587.5618)
    vd = m["vd"] if isinstance(m, dict) else G.catalog()[m]["vd"]
    data = dict(element=f"S{a+1}-S{b+1}", material=m if isinstance(m, str) else f"model nd {m['nd']} vd {m['vd']}", nd=round(nd, 6), vd=round(float(vd), 3),
                ct=A["t"], ct_tol=tol["ct_mm"], od=round(2 * rm, 4), od_tol=tol["diameter_mm"],
                s1=dict(R=A["r"], clear=2 * A["semi"], sag_edge=round(sag(A, rm), 5), conic=A.get("conic", 0.0), aspheric=A.get("aspheric", []), **codes["S1"]),
                s2=dict(R=B["r"], clear=2 * B["semi"], sag_edge=round(sag(B, rm), 5), conic=B.get("conic", 0.0), aspheric=B.get("aspheric", []), **codes["S2"]),
                material_codes=[codes["0"], codes["1"], codes["2"]],
                edge_thickness=round(A["t"] - sag(A, rm) + sag(B, rm), 4), test_wavelength_nm=design.LAMBDA_TEST_NM, note="Generated by lenspipe. No shop has reviewed it. Notation from public ISO 10110 tutorials; the purchased standard was not read.")
    txt = [f"ELEMENT {data['element']}", f"Material {data['material']}  nd {data['nd']}  vd {data['vd']}", f"CT {data['ct']} +- {data['ct_tol']} mm", f"OD {data['od']} +- {data['od_tol']} mm",
           f"Edge thickness {data['edge_thickness']} mm", *data["material_codes"], "Left surface", f"  R {A['r']}  clear dia {2*A['semi']}", "  " + codes["S1"]["form"], "  " + codes["S1"]["center"], "  " + codes["S1"]["imp"],
           "Right surface", f"  R {B['r']}  clear dia {2*B['semi']}", "  " + codes["S2"]["form"], "  " + codes["S2"]["center"], "  " + codes["S2"]["imp"], data["note"]]
    Path(str(path_stem) + ".txt").write_text("\n".join(txt) + "\n", encoding="utf-8")
    Path(str(path_stem) + ".svg").write_text(_svg(A, B, rm, txt), encoding="utf-8")
    return data


def _svg(A, B, rm, txt):
    k = 150 / rm
    pts = [(A["t"] * 0 + sag(A, float(h)), float(h)) for h in np.linspace(-rm, rm, 81)] + [(A["t"] + sag(B, float(h)), float(h)) for h in np.linspace(rm, -rm, 81)]
    path = " ".join(f"{'M' if i == 0 else 'L'} {200 + x * k:.2f} {200 - y * k:.2f}" for i, (x, y) in enumerate(pts)) + " Z"
    tx = "".join(f'<text x="520" y="{40 + 18 * i}" font-size="13" font-family="Hanken Grotesk, sans-serif">{l.replace("&", "and")}</text>' for i, l in enumerate(txt[:-1]))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 420" width="1000" height="420"><rect width="1000" height="420" fill="#fff"/>'
            f'<path d="{path}" fill="#dbe9f6" stroke="#111" stroke-width="1.4"/><line x1="40" y1="200" x2="490" y2="200" stroke="#555" stroke-dasharray="14 4 2 4"/>{tx}</svg>')
