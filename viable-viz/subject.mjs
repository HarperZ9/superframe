// subject.mjs — Subject constructors for Viable Visualization (Task 1).
// Zero external dependencies; ESM.

import { readFileSync } from "node:fs";
import { polytope } from "../render-nd/index.mjs";

// ---------------------------------------------------------------------------
// polytopeSubject
// ---------------------------------------------------------------------------

/**
 * polytopeSubject(kind, n) → { kind:"polytope", structure:{kind,n},
 *   criterion:{vertices, edges, polytopeKind} }
 * Criterion counts are read directly from render-nd's polytope().
 */
export function polytopeSubject(kind, n) {
  const p = polytope(kind, n);
  return {
    kind: "polytope",
    structure: { kind, n },
    criterion: {
      vertices: p.verts.length,
      edges: p.edges.length,
      polytopeKind: kind,
    },
  };
}

// ---------------------------------------------------------------------------
// graphSubject helpers: union-find + degree sequence
// ---------------------------------------------------------------------------

function makeUnionFind(size) {
  const parent = Int32Array.from({ length: size }, (_, i) => i);
  const rank = new Int32Array(size);

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path halving
      x = parent[x];
    }
    return x;
  }

  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else { parent[rb] = ra; rank[ra]++; }
  }

  function componentCount() {
    let count = 0;
    for (let i = 0; i < size; i++) if (find(i) === i) count++;
    return count;
  }

  return { find, union, componentCount };
}

// ---------------------------------------------------------------------------
// graphSubject
// ---------------------------------------------------------------------------

/**
 * graphSubject(graph) where graph = { nodes:[id,...], edges:[[i,j],...] }
 * (edges are 0-based indices into nodes array)
 * → { kind:"graph", structure:{graph}, criterion:{nodeCount, edgeCount,
 *     degreeSeq, components} }
 */
export function graphSubject(graph) {
  const { nodes, edges } = graph;
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  // Degree sequence
  const deg = new Int32Array(nodeCount);
  for (const [i, j] of edges) {
    if (i >= 0 && i < nodeCount) deg[i]++;
    if (j >= 0 && j < nodeCount) deg[j]++;
  }
  const degreeSeq = Array.from(deg).sort((a, b) => a - b);

  // Connected components via union-find
  const uf = makeUnionFind(nodeCount);
  for (const [i, j] of edges) {
    if (i >= 0 && i < nodeCount && j >= 0 && j < nodeCount) {
      uf.union(i, j);
    }
  }
  const components = nodeCount === 0 ? 0 : uf.componentCount();

  return {
    kind: "graph",
    structure: { graph },
    criterion: { nodeCount, edgeCount, degreeSeq, components },
  };
}

// ---------------------------------------------------------------------------
// Synthetic fallback ecosystem (~12 nodes representing real workspace lanes)
// ---------------------------------------------------------------------------

const SYNTHETIC_ECOSYSTEM = (() => {
  // Deterministic representative subgraph of the real workspace.
  // Names mirror real workspace projects; edges mirror plausible dependencies.
  const nodes = [
    "accountable-surface",  // 0
    "coherence-membrane",   // 1
    "studio-libs",          // 2
    "render-nd",            // 3
    "render-sound",         // 4
    "sense-core",           // 5
    "viable-viz",           // 6
    "studio-engine",        // 7
    "portfolio-site",       // 8
    "project-docs",         // 9
    "workspace-repo-map",   // 10
    "orca",                 // 11
  ];
  const edges = [
    [3, 2],   // render-nd → studio-libs
    [4, 2],   // render-sound → studio-libs
    [5, 2],   // sense-core → studio-libs
    [6, 3],   // viable-viz → render-nd
    [6, 4],   // viable-viz → render-sound
    [6, 5],   // viable-viz → sense-core
    [7, 3],   // studio-engine → render-nd
    [7, 5],   // studio-engine → sense-core
    [1, 5],   // coherence-membrane → sense-core
    [0, 1],   // accountable-surface → coherence-membrane
    [8, 9],   // portfolio-site → project-docs
    [10, 9],  // workspace-repo-map → project-docs
  ];
  return { nodes, edges };
})();

// ---------------------------------------------------------------------------
// ecosystemSubject
// ---------------------------------------------------------------------------

/**
 * ecosystemSubject(path?) → graphSubject result (never throws).
 * Reads WORKSTATION-ECOSYSTEM.json; if absent/unparseable → synthetic fallback.
 * Adds .source = "ecosystem-map" | "synthetic-fallback" and optionally .truncatedTo.
 *
 * The JSON schema is { projects: [ { name, goals:[ referencedProjectName, ... ], ... } ] }
 * Nodes = project names; edges = goal references (project → dependency).
 * Graph is bounded to first 60 nodes + their induced edges (>60 nodes in real file).
 */
export async function ecosystemSubject(
  path = "c:/dev/project-docs/maps/WORKSTATION-ECOSYSTEM.json"
) {
  const MAX_NODES = 60;

  let rawGraph = null;
  let source = "synthetic-fallback";
  let truncatedTo = null;

  try {
    const text = readFileSync(path, "utf8");
    const json = JSON.parse(text);

    // Try shape: { projects: [ { name, goals:[ names... ] } ] }
    if (Array.isArray(json.projects)) {
      const projects = json.projects;

      // Build node index from names
      let selectedProjects = projects;
      if (projects.length > MAX_NODES) {
        selectedProjects = projects.slice(0, MAX_NODES);
        truncatedTo = MAX_NODES;
      }

      const nodeNames = selectedProjects.map((p) => p.name);
      const nameToIdx = new Map(nodeNames.map((name, i) => [name, i]));

      // Build edges from goals references (induced subgraph only)
      const edges = [];
      for (let i = 0; i < selectedProjects.length; i++) {
        const p = selectedProjects[i];
        if (Array.isArray(p.goals)) {
          for (const goalName of p.goals) {
            const j = nameToIdx.get(goalName);
            if (j !== undefined && j !== i) {
              edges.push([i, j]);
            }
          }
        }
      }

      rawGraph = { nodes: nodeNames, edges };
      source = "ecosystem-map";
    }
    // Try shape: { nodes:[...], edges:[...] } or { nodes:[...], links:[...] }
    else if (Array.isArray(json.nodes)) {
      const nodeList = json.nodes.map((n, i) =>
        typeof n === "object" ? (n.id ?? n.name ?? i) : n
      );
      const edgeList = (json.edges || json.links || []).map((e) => {
        if (Array.isArray(e)) return e;
        // {source, target} shape
        return [e.source, e.target];
      });
      rawGraph = { nodes: nodeList, edges: edgeList };
      source = "ecosystem-map";
    }
  } catch (_) {
    // File missing, unreadable, or unparseable — fall through to synthetic
  }

  if (!rawGraph) {
    rawGraph = SYNTHETIC_ECOSYSTEM;
    source = "synthetic-fallback";
    truncatedTo = null;
  }

  const result = graphSubject(rawGraph);
  result.source = source;
  if (truncatedTo !== null) result.truncatedTo = truncatedTo;
  return result;
}
