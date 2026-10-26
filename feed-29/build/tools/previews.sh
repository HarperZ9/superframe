#!/bin/sh
# previews.sh: web derivatives (lossy WebP, q 90) of the masters for the gallery page. Run from build/.
FF=${FFMPEG:-D:/venvs/ytdlp/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe}
P=out/previews; mkdir -p $P; O28=../../2026-10-24-feed-test-28/build/out
for f in capsules-c1 capsules-c2 spheres-s1 spheres-s2 wedges-w1 metaballs-m1 subdivide-d1 steps-p1; do
  for w in 960 1600; do "$FF" -v error -y -i "out/master/$f-3840.png" -vf "scale=$w:-2:flags=lanczos,format=rgb24" -c:v libwebp -quality 90 "$P/$f-$w.webp"; done
done
for f in ink-marker-2f6bd8-2048 ink-marker-d8402f-2048 ink-twotone-f2b230-2048; do
  "$FF" -v error -y -i "out/$f.png" -vf "scale=1600:-2:flags=$( [ "${f#pixel}" != "$f" ] && echo neighbor || echo lanczos ),format=rgb24" -c:v libwebp -quality 92 "$P/$f-1600.webp"
done
"$FF" -v error -y -i "$O28/illusion-ambiguous-1080.png" -vf format=rgb24 -c:v libwebp -quality 90 "$P/illusion-poster-1080.webp"
"$FF" -v error -y -i "$O28/timebands-1280.png" -vf format=rgb24 -c:v libwebp -quality 90 "$P/timebands-poster-1280.webp"
# the two mediums at 1536 wide: the pixel art's 5 px cell becomes exactly 4 px (nearest), so no art pixel is split
for f in painting-valley-1920 pixel-valley-1920; do fl=lanczos; [ "$f" = pixel-valley-1920 ] && fl=neighbor; "$FF" -v error -y -i "out/$f.png" -vf "scale=1536:-2:flags=$fl,format=rgb24" -c:v libwebp -quality 92 "$P/$f-1536.webp"; done
