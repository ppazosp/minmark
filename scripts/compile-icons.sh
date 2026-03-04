#!/bin/bash
set -euo pipefail

DEST="src-tauri/icons/AppIcon.xcassets/AppIcon.appiconset"

for SIZE in 16 32 128 256 512; do
  DOUBLE=$((SIZE * 2))
  magick -background none -density 300 icon-light.svg -resize "${SIZE}x${SIZE}" "$DEST/icon_${SIZE}x${SIZE}.png"
  magick -background none -density 300 icon-dark.svg  -resize "${SIZE}x${SIZE}" "$DEST/icon_${SIZE}x${SIZE}_dark.png"
  magick -background none -density 300 icon-light.svg -resize "${DOUBLE}x${DOUBLE}" "$DEST/icon_${SIZE}x${SIZE}@2x.png"
  magick -background none -density 300 icon-dark.svg  -resize "${DOUBLE}x${DOUBLE}" "$DEST/icon_${SIZE}x${SIZE}@2x_dark.png"
done

mkdir -p src-tauri/assets
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun actool \
  --compile src-tauri/assets/ \
  --app-icon AppIcon \
  --platform macosx \
  --minimum-deployment-target 10.14 \
  --output-partial-info-plist /dev/null \
  src-tauri/icons/AppIcon.xcassets

echo "Assets.car compiled successfully"
