#!/bin/sh
# Rebuild the BuildLang combat-step port and compare its 40 traces with the JS sim's.
# Usage: tools/buildlang-combat-port/run.sh <buildc> <work dir>
set -e
BUILDC=$1; WORK=$2; HERE=$(cd "$(dirname "$0")" && pwd); ENGINE=$HERE/../../game/engine
mkdir -p "$WORK/js" "$WORK/bl" "$WORK/eng" "$WORK/port"
cp -r "$ENGINE"/. "$WORK/eng/"
cp "$HERE/export-step-inputs.mjs" "$WORK/eng/"
(cd "$WORK/eng" && node combat/tools/trace.mjs "$WORK/js" 40 900 && node export-step-inputs.mjs "$WORK/inputs.json")
cp "$HERE"/src/*.bld "$WORK/port/"
(cd "$WORK/port" && "$BUILDC" build --release .)
"$WORK/port/target/release/main.exe" "$WORK/inputs.json" "$WORK/js" "$WORK/bl"
