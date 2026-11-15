#!/usr/bin/env bash
# Rebake plates into a scratch folder and compare them with the lock, file by file (plates pass 2026-10-24). The scratch
# folder starts as a clean checkout would: each plate's tracked place.json and arena-*.json are copied in first, so the
# bake sees the same variant order and arena files. Writes $LW_TMP/report.tsv (plate, file, same | differs | missing |
# new), $LW_TMP/<plate>.log and times.txt. Up to LW_JOBS bakes at once (default 4, each with six shade workers); temp files go
# to LW_TMP (default: beside the scratch folder; keep both off a full system drive). The folder can be content itself
# for a real rebake, with LW_TMP set outside the repository. Run from the repo root:
#   bash render/bake_check.sh <scratch folder> q_sheaf q_town ...
#   LW_TMP=/tmp/lw bash render/bake_check.sh content q5_police ...
set -u
dst=$1; shift
mkdir -p "$dst"; export dst
export TMP="${LW_TMP:-$(dirname "$dst")/lw-tmp}"; export TEMP="$TMP"; mkdir -p "$TMP"
one() {
  p=$1
  mkdir -p "$dst/$p"; [ "$dst" = content ] || cp content/$p/place.json content/$p/arena-*.json "$dst/$p/" 2>/dev/null
  t0=$(date +%s)
  LW_PLATE=1 node render/bake2.mjs --place $p --out "$dst" > "$TMP/$p.log" 2>&1 || { echo "$p: bake failed"; return; }
  v=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$dst/$p/place.json','utf8')).variants.map(v=>'$p/'+v).join(','))")
  python render/tools/restreak.py --src "$dst" --dst "$dst" --only "$v" >> "$TMP/$p.log" 2>&1
  node -e '
    const fs = require("fs"), c = require("crypto"), [p, dst] = process.argv.slice(1), L = JSON.parse(fs.readFileSync("content/PLATES.lock", "utf8")).plates[p] || { files: {} };
    const h = (f) => { let b = fs.readFileSync(f); if (/\.json$/.test(f)) b = Buffer.from(b.toString("latin1").replace(/\r\n/g, "\n"), "latin1"); return c.createHash("sha256").update(b).digest("hex"); }, rows = [];
    for (const [f, e] of Object.entries(L.files)) { const q = `${dst}/${p}/${f}`; rows.push([p, f, !fs.existsSync(q) ? "missing" : h(q) === e.sha256 ? "same" : "differs"]); }
    for (const f of fs.readdirSync(`${dst}/${p}`)) if (!L.files[f] && !f.includes(".part")) rows.push([p, f, "new"]);
    fs.appendFileSync(`${process.env.TMP}/report.tsv`, rows.map((r) => r.join("\t")).join("\n") + "\n");
    const d = rows.filter((r) => r[2] !== "same").length; console.log(`${p}: ${d ? `${d} of ${rows.length} files differ` : "all files the same"}`);' "$p" "$dst"
  echo "$p: $(( $(date +%s) - t0 )) s" >> "$TMP/times.txt"
}
export -f one
printf '%s\n' "$@" | xargs -P "${LW_JOBS:-4}" -I{} bash -c 'one {}'
