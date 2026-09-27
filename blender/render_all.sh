#!/usr/bin/env bash
# Final-quality render queue. Usage: blender/render_all.sh [shots...]
set -euo pipefail
cd "$(dirname "$0")/.."
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
SHOTS=${*:-"hero studio array formation onboarding satellite detail_sensor detail_wheel"}
for s in $SHOTS; do
  echo "== $s"
  "$B" -b -P blender/render_scenes.py -- "$s" --samples 128 2>&1 | grep -E "RENDERED|Error|Traceback" || true
done
