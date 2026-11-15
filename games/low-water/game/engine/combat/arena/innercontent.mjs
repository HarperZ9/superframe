// What the inner arena reads from the Quota's content, never copies (combat/PROGRESS.md 29): the cast (@char), the
// scene files (for a beat's scene), the self-lies' rows (@selflie happened:) and the lines that told them (a voice
// line tagged {self: id}). Pure over { file name: text }, so the arena page (fetched) and the checkers (read from
// disk, combat/tools/innerctx.mjs) parse the same way.
//   parseContent(files) -> { chars: Set, scenes: Set, selflies: { id: { happened: [text], told: { voice, text, file } | null } } }
export function parseContent(files) {
  const chars = new Set(), scenes = new Set(), selflies = {};
  for (const [name, raw] of Object.entries(files)) {
    const text = raw.replace(/\r\n?/g, "\n"); // `.` stops at a carriage return
    scenes.add(name.replace(/\.lwd$/, ""));
    for (const m of text.matchAll(/^@char\s+(\S+)/gm)) chars.add(m[1]);
    // @selflie id, then its key lines until a blank line
    for (const m of text.matchAll(/^@selflie\s+(\S+)\s*\n((?:[a-z]+:.*\n?)*)/gm)) {
      const happened = [...m[2].matchAll(/^happened:\s*(.*)$/gm)].map((h) => h[1].replace(/\s+\?\s+[^?]*$/, "").trim());
      selflies[m[1]] = { ...(selflies[m[1]] || {}), happened };
    }
    for (const m of text.matchAll(/^voice:\s*([a-z_]+):\s*(.*?)\s*\{[^}]*\bself:\s*([\w.]+)[^}]*\}\s*$/gm)) {
      selflies[m[3]] = { happened: [], ...(selflies[m[3]] || {}), told: { voice: m[1], text: m[2].trim(), file: name } };
    }
  }
  return { chars, scenes, selflies };
}

// The rows the naming offers for a self-lie: what was told (the line) and what happened (the row's last line
// with no condition, else its first): the world as it stands is the story's to choose, not the arena's.
export function rowOf(ctx, selflie) {
  const s = (ctx && ctx.selflies[selflie]) || null; if (!s) return null;
  return { id: selflie, told: s.told ? s.told.text : null, voice: s.told ? s.told.voice : null, happened: s.happened.length ? s.happened[s.happened.length - 1] : null };
}
