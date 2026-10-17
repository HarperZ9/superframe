#!/usr/bin/env bash
# Run drive.py at Idle priority (Windows), no window; children (node, Chromium) inherit the class.
# Usage: game/tools/idle_drive.sh <log> <drive.py args...>   (args without spaces)
log="$1"; shift
powershell -NoProfile -Command "\$p = Start-Process -FilePath python -ArgumentList 'game/tools/drive.py $*' -PassThru -NoNewWindow -RedirectStandardOutput '$log' -RedirectStandardError '$log.err'; \$p.PriorityClass = 'Idle'; \$p.WaitForExit(); exit \$p.ExitCode"
code=$?; tail -n 20 "$log" "$log.err" 2>/dev/null; exit $code
