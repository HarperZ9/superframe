#!/usr/bin/env bash
# Wait until no queue for <lane-log> is running, then run a queue: render/chain.sh <wait-lane-log> <new-lane-log> <place...>
cd "$(dirname "$0")/.."; wait_for="$1"; shift
busy() { powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='bash.exe'\" | Where-Object { \$_.CommandLine -like '*queue.sh $wait_for*' } | Measure-Object | Select-Object -ExpandProperty Count"; }
while [ "$(busy | tr -d '\r')" != "0" ]; do sleep 30; done
bash render/queue.sh "$@"
