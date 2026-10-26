// tools/check_comment_swallow.mjs: flag any line where code follows `//` on the same line. A line comment runs to the
// end of the line, so code written after it never runs; this bug swallowed `this.wind = 0` on 2026-10-26 and turned
// every field NaN. The check looks inside line comments for what reads as a statement: an assignment or call on
// `this.`, a declaration, `name = value;`, or a dotted call ending `);` (rule from the UI agent, 2026-10-26). URLs,
// a regex's escaped slash (`\/`) and prose are left alone.
// A second rule flags a comment that closes a bracket the code before it left open, with an object entry inside.
//   node tools/check_comment_swallow.mjs [dir ...]      exit 1 when anything is flagged
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BACKSLASH = String.fromCharCode(92);
const STATEMENT = /(this\.[\w$]+(\.[\w$]+)*\s*(=[^=]|\())|\b(const|let|var)\s+[\w$]+\s*=|[\w$.\]]+\s*=\s*[^\s=>;,]+\s*;|\b[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+\([^;]*\)\s*;/;
export function swallowed(src) {
  const out = [];
  src.split('\n').forEach((line, i) => {
    // find a `//` outside strings and regex-ish contexts (a simple scan: skip quoted spans)
    let q = null, at = -1;
    for (let k = 0; k < line.length - 1; k++) { const c = line[k]; if (q) { if (c === BACKSLASH) k++; else if (c === q) q = null; continue; } if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '/' && line[k + 1] === '/' && line[k - 1] !== ':' && line[k - 1] !== BACKSLASH) { at = k; break; } }
    // only a comment that trails code on the same line: a whole-line comment with an example in it is documentation
    if (at < 0 || !line.slice(0, at).trim()) return;
    const comment = line.slice(at + 2);
    // a second rule (2026-10-26, after a swallowed object entry in a test): the code before the comment leaves a
    // bracket open, and the comment closes it and ends the statement, so the closing half was meant as code
    const code = line.slice(0, at), open = (code.match(/[[({]/g) ?? []).length - (code.match(/[\])}]/g) ?? []).length;
    const closesIt = open > 0 && /[\])}]\s*[;,)]?\s*$/.test(comment.trim()) && (comment.match(/[\])}]/g) ?? []).length >= open && /[\w$]+\s*:\s*[[({\w'"]/.test(comment);
    if (STATEMENT.test(comment) || closesIt) out.push({ line: i + 1, text: line.trim().slice(0, 160) });
  });
  return out;
}
function walk(d, files = []) { for (const n of readdirSync(d)) { const p = join(d, n); if (n === 'node_modules' || n.startsWith('.')) continue; if (statSync(p).isDirectory()) walk(p, files); else if (/\.(mjs|js)$/.test(n)) files.push(p); } return files; }
if (process.argv[1]?.endsWith('check_comment_swallow.mjs')) {
  const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['lib', 'adapters', 'tools', 'cli', 'room', 'explore'];
  let n = 0;
  for (const d of dirs) { let files = []; try { files = walk(d); } catch { continue; } for (const f of files) for (const h of swallowed(readFileSync(f, 'utf8'))) { console.log(`${f}:${h.line}: code after // : ${h.text}`); n++; } }
  console.log(n ? `${n} line(s) flagged` : 'no code after // found'); process.exit(n ? 1 : 0);
}
