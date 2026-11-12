// Restoration projects: the town put back together, one stage at a time, and kept.
//   @project id  name, about, district
//                stage: Stage name | needs: item n, item n | do: effects | about: text   (repeatable)
//   state.projects = { id: stagesDone }
// contribute(id) takes the next stage's materials from the inventory and runs its effects.
// Expressions read project.id as the number of stages done.
import { compileEffects, runEffects } from "../core/expr.mjs";
import { parseCount } from "../rules/ruleset.mjs";

export function loadProjects(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).project || {})) {
    const g = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
    try {
      const stages = r.kv.filter((e) => e.key === "stage").map((e) => {
        const parts = e.value.split(" | ").map((s) => s.trim()), st = { name: parts[0], needs: [], effects: null, about: "" };
        for (const p of parts.slice(1)) {
          const k = p.indexOf(":"), key = p.slice(0, k).trim(), v = p.slice(k + 1).trim();
          if (key === "needs") st.needs = v.split(",").filter((x) => x.trim()).map(parseCount);
          else if (key === "do") st.effects = compileEffects(v);
          else if (key === "about") st.about = v;
          else throw new SyntaxError(`stage: unknown part "${key}"`);
        }
        return st;
      });
      out[r.id] = { id: r.id, name: g("name") || r.id, about: g("about") || "", district: g("district") || null, stages, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `project ${r.id}: ${e.message}` }); }
  }
  return { projects: out, errors };
}

export function createSettlement(G, projects) {
  const P = () => (G.state.projects ||= {});
  const api = {
    done: (id) => P()[id] || 0,
    next: (id) => (projects[id] ? projects[id].stages[api.done(id)] || null : null),
    whyNot(id) {
      const s = api.next(id); if (!s) return "Finished";
      for (const c of s.needs) if (G.inv.count(c.id) < c.n) return `Needs ${c.n} ${G.rs.items[c.id] ? G.rs.items[c.id].name : c.id} (have ${G.inv.count(c.id)})`;
      return null;
    },
    contribute(id) {
      const why = api.whyNot(id); if (why) return why;
      const s = api.next(id);
      for (const c of s.needs) G.inv.take(c.id, c.n);
      P()[id] = api.done(id) + 1;
      if (s.effects) runEffects(s.effects, G.scope);
      G.emit("project", { id, stage: s.name, done: api.done(id), of: projects[id].stages.length });
      return null;
    },
    list: () => Object.values(projects).map((p) => ({ ...p, done: api.done(p.id), next: api.next(p.id), why: api.whyNot(p.id) })),
  };
  return api;
}
