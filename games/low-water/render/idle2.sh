#!/usr/bin/env bash
# Run a bake2 job at Idle priority and wait. Usage: render/idle2.sh <log> <bake2 args...>
cd "$(dirname "$0")/.."; log="$1"; shift
export LW_PLATE=1
powershell -NoProfile -Command "\$p = Start-Process -FilePath node -ArgumentList 'render/bake2.mjs $*' -PassThru -NoNewWindow -RedirectStandardOutput '$log' -RedirectStandardError '$log.err'; \$p.PriorityClass = 'Idle'; \$p.WaitForExit(); exit \$p.ExitCode"
code=$?; tail -3 "$log"; tail -15 "$log.err" 2>/dev/null; exit $code
