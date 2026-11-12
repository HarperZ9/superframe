#!/usr/bin/env bash
# Run a design/ux Python script at Idle priority (Windows), no window. Usage: design/ux/idle_eval.sh <script.py> [args]
log=design/ux/shots/eval.log
powershell -NoProfile -Command "\$p = Start-Process -FilePath python -ArgumentList '$*' -PassThru -NoNewWindow -RedirectStandardOutput '$log' -RedirectStandardError '$log.err'; \$p.PriorityClass = 'Idle'; \$p.WaitForExit(); exit \$p.ExitCode"
code=$?; cat "$log"; tail -n 15 "$log.err" 2>/dev/null; exit $code
