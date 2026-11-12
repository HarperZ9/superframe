#!/usr/bin/env bash
# Run node at Idle priority (Windows) and wait; log to $LW_LOG. Usage: render/idle.sh <node args...>
# Inline -Command, so no script file and no execution-policy change is needed. Arguments must not
# contain spaces or quotes.
log="${LW_LOG:-render/idle.log}"
powershell -NoProfile -Command "\$p = Start-Process -FilePath node -ArgumentList '$*' -PassThru -NoNewWindow -RedirectStandardOutput '$log' -RedirectStandardError '$log.err'; \$p.PriorityClass = 'Idle'; \$p.WaitForExit(); exit \$p.ExitCode"
code=$?; cat "$log" "$log.err" 2>/dev/null; exit $code
