#!/bin/bash
# All pose sheets for one character, two at a time (Idle priority is set inside each job).
who=${1:-lamb}; cd "$(dirname "$0")/.."
clips="idle walk run turn stop talk_a talk_b talk_c examine dodge_f dodge_b dodge_l dodge_r light_1 light_2 light_3 heavy hit stagger fall getup"
set -- $clips
while [ $# -gt 0 ]; do
  node proto/sheet.mjs $who $1 8 & 
  [ -n "$2" ] && node proto/sheet.mjs $who $2 8 &
  wait; shift; [ $# -gt 0 ] && shift
done
