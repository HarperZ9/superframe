// Stylesheets loaded as text and put in <style> tags. game/serve.mjs has no .css type, so a
// <link rel="stylesheet"> would be served as application/octet-stream and refused.
const SHEETS = ["theme.css", "tokens.css", "panels.css", "daybook.css", "ux.css"]; // ux: tokens and ux are the UI lead's

export async function loadStyles() {
  const texts = await Promise.all(SHEETS.map(async (f) => {
    const r = await fetch(new URL(f, import.meta.url));
    if (!r.ok) throw new Error(`could not load ${f}: ${r.status}`);
    return r.text();
  }));
  for (const [i, t] of texts.entries()) {
    const s = document.createElement("style"); s.dataset.sheet = SHEETS[i]; s.textContent = t;
    document.head.append(s);
  }
}
