#!/bin/sh
# previews.sh: web derivatives of the 4K masters (lossy WebP, q 90) at 1200, 1600 and 2400 px. Run from build/.
FF=${FFMPEG:-D:/venvs/ytdlp/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe}
for f in sheet-one sheet-two glyph-field static-weather; do
  for w in 1200 1600 2400; do "$FF" -v error -y -i "out/$f.png" -vf "scale=$w:$w:flags=lanczos,format=rgb24" -c:v libwebp -quality 90 "previews/$f-$w.webp"; done
done
"$FF" -v error -y -i out/feedback-plate-poster.png -vf "format=rgb24" -c:v libwebp -quality 90 previews/feedback-plate-poster-1080.webp
