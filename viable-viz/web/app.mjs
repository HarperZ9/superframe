/**
 * app.mjs — Minimal browser surface for Viable Visualization (Task 5).
 *
 * Exports:
 *   init(opts?)  — wire DOM (canvas + panel + controls); start render loop.
 *   run(subject) — run reconcile on the current subject; display the Certificate.
 *
 * No DOM calls at module top-level — safe to import in Node for smoke testing.
 * Zero external deps; ESM; WebGL1 with 2D-canvas fallback.
 */

import { renderScene }      from "../../render-nd/index.mjs";
import { drawSceneGL }      from "../../render-nd/backends/webgl.mjs";
import { polytopeSubject, ecosystemSubject } from "../subject.mjs";
import { embedGraph }       from "../embed.mjs";
import { reconcile }        from "../reconcile.mjs";
import { groundedRegulator } from "../regulator.mjs";

// ── Module-level state (no DOM access here) ───────────────────────────────────

let _canvas = null;
let _gl = null;
let _ctx2d = null;
let _verdictEl = null;
let _ampsEl = null;
let _discEl = null;
let _rafId = null;
let _scene = null;
let _t = 0;
let _currentSubject = null;

// ── Scene builder ─────────────────────────────────────────────────────────────

function buildScene(subject, t) {
  if (!subject) return null;
  if (subject.kind === "polytope") {
    const { kind, n } = subject.structure;
    return renderScene({ kind, n, t, rotation: "all",
      projection: { mode: "perspective", dist: 3 }, scale: 0.5 });
  }
  // graph
  const { graph } = subject.structure;
  const { verts, edges } = embedGraph(graph, 4);
  if (verts.length === 0) return { points: [], segments: [], meta: { kind: "graph" } };
  const cosT = Math.cos(t), sinT = Math.sin(t);
  const dist = 3.0, scale = 0.5;
  const pts = verts.map(v => {
    const px = v[0] * cosT - v[2] * sinT;
    const py = v[1] * cosT - v[3] * sinT;
    const pz = v[0] * sinT + v[2] * cosT + dist;
    const w = pz > 0.1 ? pz : 0.1;
    return { x: (px / w) * scale, y: (py / w) * scale, depth: pz };
  });
  let dmin = Infinity, dmax = -Infinity;
  for (const p of pts) { if (p.depth < dmin) dmin = p.depth; if (p.depth > dmax) dmax = p.depth; }
  const dspan = dmax - dmin || 1;
  const points = pts.map(p => {
    const nd = (p.depth - dmin) / dspan;
    const b = Math.round(180 + 75 * nd);
    return { x: p.x, y: p.y, size: 1.5 + nd, opacity: 0.4 + 0.6 * nd, color: [b, b, Math.round(b * 0.8)] };
  });
  const segments = edges.map(([i, j]) => {
    if (i < 0 || i >= points.length || j < 0 || j >= points.length) return null;
    const a = points[i], b = points[j];
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      opacity: (a.opacity + b.opacity) / 2 * 0.7, color: [120, 160, 200] };
  }).filter(Boolean);
  return { points, segments, meta: { kind: "graph", nodeCount: verts.length } };
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function drawGL(scene) {
  const w = _canvas.width, h = _canvas.height;
  drawSceneGL(_gl, scene, { width: w, height: h });
}

function draw2D(scene) {
  const ctx = _ctx2d;
  const w = _canvas.width, h = _canvas.height;
  ctx.fillStyle = "#090d11";
  ctx.fillRect(0, 0, w, h);
  const toX = x => (x + 1) / 2 * w;
  const toY = y => (1 - (y + 1) / 2) * h;
  for (const s of scene.segments) {
    ctx.strokeStyle = `rgba(${s.color[0]},${s.color[1]},${s.color[2]},${s.opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(s.x1), toY(s.y1));
    ctx.lineTo(toX(s.x2), toY(s.y2));
    ctx.stroke();
  }
  for (const p of scene.points) {
    ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${p.opacity})`;
    ctx.beginPath();
    ctx.arc(toX(p.x), toY(p.y), Math.max(1.5, p.size), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScene(scene) {
  if (!scene) return;
  if (_gl) drawGL(scene); else if (_ctx2d) draw2D(scene);
}

// ── rAF render loop ───────────────────────────────────────────────────────────

function tick() {
  _t += 0.008;
  _scene = buildScene(_currentSubject, _t);
  drawScene(_scene);
  _rafId = requestAnimationFrame(tick);
}

// ── Panel helpers ─────────────────────────────────────────────────────────────

function setPanel(verdict, amplifications, disclosure) {
  if (_verdictEl) {
    _verdictEl.textContent = verdict;
    _verdictEl.style.color = verdict === "CERTIFIED" ? "#4ade80" : "#fbbf24";
  }
  if (_ampsEl) {
    _ampsEl.textContent = amplifications.length
      ? amplifications.map(a => a.label).join(" → ")
      : "none";
  }
  if (_discEl) _discEl.textContent = disclosure;
}

// ── Subject selector ──────────────────────────────────────────────────────────

async function subjectFromKey(key) {
  if (key === "ecosystem") return await ecosystemSubject();
  if (key === "simplex")   return polytopeSubject("simplex", 4);
  return polytopeSubject("cube", 4); // default
}

// ── Exported API ──────────────────────────────────────────────────────────────

/**
 * init(opts?) — find canvas + panel elements; wire controls; start render loop.
 * Must be called after DOMContentLoaded. Safe to call only in a browser context.
 */
export function init(opts = {}) {
  _canvas = document.getElementById("viz");
  _verdictEl = document.getElementById("verdict");
  _ampsEl    = document.getElementById("amplifications");
  _discEl    = document.getElementById("disclosure");

  // Prefer WebGL1; fall back to 2D canvas.
  try {
    _gl = _canvas.getContext("webgl") || _canvas.getContext("experimental-webgl");
  } catch (_) { _gl = null; }
  if (!_gl) _ctx2d = _canvas.getContext("2d");

  // Default subject
  _currentSubject = polytopeSubject("cube", 4);

  // Wire selector
  const sel = document.getElementById("subject-select");
  if (sel) {
    sel.addEventListener("change", async () => {
      _currentSubject = await subjectFromKey(sel.value);
    });
  }

  // Wire Reconcile button
  const btn = document.getElementById("reconcile-btn");
  if (btn) {
    btn.addEventListener("click", () => run(_currentSubject));
  }

  // Start render loop
  if (_rafId) cancelAnimationFrame(_rafId);
  tick();
}

/**
 * run(subject?) — run reconcile on subject (defaults to current); update panel.
 * Async; updates the verdict panel live with the Certificate result.
 */
export async function run(subject) {
  const subj = subject || _currentSubject;
  if (!subj) return;

  if (_verdictEl) { _verdictEl.textContent = "running…"; _verdictEl.style.color = "#94a3b8"; }

  const reg = groundedRegulator(subj.criterion);
  const cert = await reconcile(subj, { regulator: reg, width: 192 });

  setPanel(cert.verdict, cert.amplifications, cert.disclosure);

  // Surface recovered-vs-criterion in the amplifications panel
  if (_ampsEl) {
    const steps = cert.amplifications.length
      ? cert.amplifications.map(a => `${a.label}→${a.verdict}`).join(", ")
      : "initial pass";
    const rec = cert.recovered;
    const truth = cert.criterion;
    const recLine = subj.kind === "polytope"
      ? ` | V:${rec.vertices}/${truth.vertices} E:${rec.edges}/${truth.edges}`
      : ` | N:${rec.nodeCount ?? "?"}/${truth.nodeCount} E:${rec.edgeCount ?? "?"}/${truth.edgeCount}`;
    _ampsEl.textContent = steps + recLine;
  }
}
