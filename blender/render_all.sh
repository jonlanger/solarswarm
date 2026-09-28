#!/usr/bin/env bash
# Final-quality render queue. Usage: [SAMPLES=128] blender/render_all.sh [shots...]
# Writes public/renders/<shot>.png and the .jpg the site serves (ortho_* stay PNG: they need alpha).
set -euo pipefail
cd "$(dirname "$0")/.."
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
SAMPLES=${SAMPLES:-128}
SHOTS=${*:-"hero studio array formation onboarding satellite detail_sensor detail_wheel swap gate ortho_mojave ortho_valley ortho_permian ortho_piedmont"}
for s in $SHOTS; do
  echo "== $s"
  "$B" -b -P blender/render_scenes.py -- "$s" --samples "$SAMPLES" 2>&1 | grep -E "RENDERED|Error|Traceback" || true
  if [[ $s != ortho_* && -f public/renders/$s.png ]]; then
    sips -s format jpeg -s formatOptions 86 "public/renders/$s.png" --out "public/renders/$s.jpg" >/dev/null
  fi
done
# new pixels under the same file names: bump the URL version so browsers / the image optimizer refetch them
sed -i '' -E "s/^export const RENDER_V = \".*\";/export const RENDER_V = \"$(date +%Y%m%d-%H%M)\";/" lib/renders.ts
echo "RENDER_V -> $(grep RENDER_V lib/renders.ts | head -1)"
