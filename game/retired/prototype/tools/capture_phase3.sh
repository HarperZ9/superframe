#!/usr/bin/env bash
# Phase 3 captures at Idle, two lanes: the play-through, and the trailer in two takes joined.
cd "$(dirname "$0")/../.."
lane1() { bash game/tools/idle_drive.sh game/capture/playthrough.log --script game/tools/play2.json --out game/capture/playthrough --video --port 8751; }
lane2() { bash game/tools/idle_drive.sh game/capture/trailerA.log --script game/tools/trailerA.json --out game/capture/trailer60/A --video --port 8752 && \
          bash game/tools/idle_drive.sh game/capture/trailerB.log --script game/tools/trailerB.json --out game/capture/trailer60/B --video --port 8753; }
lane1 > /dev/null 2>&1 & lane2 > /dev/null 2>&1 & wait
ff=$(python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")
printf "file 'A/low-water-prototype.mp4'\nfile 'B/low-water-prototype.mp4'\n" > game/capture/trailer60/list.txt
(cd game/capture/trailer60 && "$ff" -y -loglevel error -f concat -safe 0 -i list.txt -c copy low-water-trailer.mp4)
mv -f game/capture/playthrough/low-water-prototype.mp4 game/capture/playthrough/low-water-playthrough.mp4
echo "captures done"
