#!/usr/bin/env bash
# Render the mood film through raw-native's Motion capture (scripts/motion_render.py) on the
# SwiftShader adapter, in 3-second chunks at Idle priority (a long single run hit intermittent POST
# timeouts from the capture page to the local server), then join the chunks without re-encoding.
# R is a scratch root holding an export of raw-native web/, the scene, its stills and the font atlas.
R="${R:-${TMPDIR:-/tmp}/low-water-filmroot}"
OUT="$(cd "$(dirname "$0")" && pwd)"
FF=$(python -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")
cd "$R" && mkdir -p chunks && : > chunks/list.txt
for s in $(seq 0 3 75); do
  e=$((s + 3)); f="chunks/c$(printf %03d $s).mp4"
  for try in 1 2 3; do
    powershell -NoProfile -Command "\$p = Start-Process -FilePath python -ArgumentList 'motion_render.py --root . --page web/motion/capture.html --scene ../../film/lowwater.scene.mjs --out $f --width 1280 --height 720 --adapter swiftshader --transport raw --codec libx264 --from $s --to $e' -PassThru -NoNewWindow -RedirectStandardOutput chunks/log.txt -RedirectStandardError chunks/err.txt; \$p.PriorityClass='Idle'; \$p.WaitForExit(); exit \$p.ExitCode"
    if [ -s "$f" ] && grep -q '"frames": 90' chunks/log.txt; then break; fi
    echo "chunk $s try $try failed"; rm -f "$f"
  done
  [ -s "$f" ] || { echo "chunk $s failed 3 times"; exit 1; }
  echo "file '$R/$f'" >> chunks/list.txt; echo "chunk $s ok"
done
"$FF" -y -loglevel error -f concat -safe 0 -i "$R/chunks/list.txt" -c copy -movflags +faststart "$OUT/low-water-mood-film-1280x720.mp4"
"$FF" -y -loglevel error -ss 20 -i "$OUT/low-water-mood-film-1280x720.mp4" -frames:v 1 "$OUT/poster.png"
echo "film done"
