#!/usr/bin/env bash
# Records the golden trace corpus (design/TRACE-FORMAT.md): the Quota slice, both built classes, seeds 1..20,
# full (era 2) and era 1 only (--until e1.). Run from game/engine:  bash tools/record-corpus.sh [outdir]
# Needs node. Writes <class>-s<NN>.jsonl and e1-<class>-s<NN>.jsonl, then manifest.json (sha256, bytes).
set -e
# CRLF guard: a script saved with CRLF line endings fails under bash in confusing ways. Stop early.
if grep -q $'' "$0"; then echo "record-corpus.sh has CRLF line endings; convert to LF (dos2unix) and rerun" >&2; exit 2; fi
OUT="${1:-tools/out/traces}"; mkdir -p "$OUT"; export LW_STORY=quota
job() { b=$1; s=$2; n=$(printf %02d "$s"); node tools/playthrough.mjs $ACTS --build "$b" --seed "$s" --tracefile "$OUT/$b-s$n.jsonl" >/dev/null 2>&1; node tools/playthrough.mjs $ACTS --build "$b" --seed "$s" --until e1. --tracefile "$OUT/e1-$b-s$n.jsonl" >/dev/null 2>&1; }
ACTS="${ACT:+--acts $ACT}"; export ACTS
export -f job; export OUT
for b in inspector militia; do for s in $(seq 1 20); do echo "$b $s"; done; done | xargs -P 6 -L 1 bash -c 'job $0 $1'
node tools/trace-manifest.mjs "$OUT"
