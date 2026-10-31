const fillShapes = (sel, skip = []) => {
  for (const [g, it] of GROUPS) {
    const o = document.createElement("optgroup");
    o.label = g;
    for (const v of it) {
      if (skip.includes(v)) continue;
      const e = document.createElement("option");
      e.value = v;
      e.textContent = v == "F" ? "Formula" : SH[v][0];
      o.append(e);
    }
    if (o.children.length) sel.append(o);
  }
};
