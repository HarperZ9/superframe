#!/usr/bin/env bash
# Run a command at Idle priority on Windows with no window; children (node, Chromium) inherit it.
# Usage: game/engine/combat/tools/idle.sh <log> <program> <args...>   (args without spaces)
log="$1"; shift
prog="$1"; shift
powershell -NoProfile -Command "\$p = Start-Process -FilePath '$prog' -ArgumentList '$*' -PassThru -NoNewWindow -RedirectStandardOutput '$log' -RedirectStandardError '$log.err'; \$p.PriorityClass = 'Idle'; \$p.WaitForExit(); exit \$p.ExitCode"
code=$?; tail -n 20 "$log" "$log.err" 2>/dev/null; exit $code
