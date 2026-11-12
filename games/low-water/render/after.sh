#!/usr/bin/env bash
# Wait until <lane-log> contains "end <place>", then run a queue: render/after.sh <lane-log> <place> <new-lane-log> <places...>
cd "$(dirname "$0")/.."; f="$1"; p="$2"; shift 2
until grep -q "end $p " "$f" 2>/dev/null; do sleep 30; done
bash render/queue.sh "$@"
