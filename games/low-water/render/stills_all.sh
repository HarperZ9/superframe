#!/usr/bin/env bash
# Before and after stills at the new camera for every plate (Idle, one job): render/stills/.
cd "$(dirname "$0")/.."
S() { powershell -NoProfile -Command "\$p = Start-Process -FilePath node -ArgumentList 'render/stills.mjs $*' -PassThru -NoNewWindow -RedirectStandardOutput render/.stills.log -RedirectStandardError render/.stills.err; \$p.PriorityClass = 'Idle'; \$p.WaitForExit()"; cat render/.stills.log; tail -3 render/.stills.err; }
for v in night rain frost dawn dark; do S quay --variant $v --at -1.5,0,-1; done
S quay --variant night --at -1.5,0,-1 --figs
S quay --variant rain --at 9,0,-3
for v in night wethour dark; do S brine --variant $v --at 0,0,0.3; done
S brine --variant night --at 0,0,0.3 --figs
for v in night dark; do S weigh --variant $v --at 0.6,0,0.8; done
S weigh --variant night --at 0.6,0,0.8 --figs
for v in lit dark frost; do S lamp --variant $v --at 0,0.8,0; done
for v in night rain fog dark; do S floor --variant $v --at -7,-3.2,8; done
for v in night frost dark; do S mole --variant $v --at 30,0,-1.6; done
for v in dark lit frost; do S stairs --variant $v --at 0,8.7,0; done
for v in night late dark; do S office --variant $v --at 0,-1,0; done
for v in night rigged frozen dark; do S gut --variant $v --at 0,0,0; done
for v in lit frost dark; do S hill --variant $v --at -9,2,2; done
for v in lit dark; do S station --variant $v --at 7,0,5; done
for v in candles opening bulb frost; do S gasholder --variant $v --at 10,0,5.5; done
for v in night frost dark; do S ropewalk --variant $v --at 13,0,3; done
for v in stars lanterns frost; do S spit --variant $v --at 12,0,5; done
for v in day late; do S quay_day --variant $v --at -3,0,-3 --before quay; done
S mole_day --variant day --at 30,0,-1.6; S brine_day --variant day --at 0,0,0.3 --before brine; S room_day --variant day --at 0,0.6,0; S room --variant night --at 0,0.6,0
S weigh_day --variant day --at 0.6,0,0.8 --before weigh; S gut_day --variant day --at 0,0,0
S wide_arrival --variant night; S wide_dawn --variant dawn; S wide_blackout --variant dark
echo stills done
