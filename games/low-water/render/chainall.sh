#!/usr/bin/env bash
# Run finish, final and extra one after another (each waits for the one before).
cd /c/dev/mission-control/2026-10-16-low-water
bash render/finish.sh > content/logs/finish.txt 2>&1
bash render/final.sh > content/logs/final.txt 2>&1
bash render/extra.sh > content/logs/extra.txt 2>&1
