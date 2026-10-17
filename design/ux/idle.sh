#!/usr/bin/env bash
# Run uxshots.py at Idle priority (Windows), no window. Usage: design/ux/idle.sh [case names...]
log=design/ux/shots/run.log
powershell -NoProfile -Command "\$p = Start-Process -FilePath python -ArgumentList 'design/ux/uxshots.py $*' -PassThru -NoNewWindow -RedirectStandardOutput '$log' -RedirectStandardError '$log.err'; \$p.PriorityClass = 'Idle'; \$p.WaitForExit(); exit \$p.ExitCode"
code=$?; cat "$log"; tail -n 15 "$log.err" 2>/dev/null; exit $code
