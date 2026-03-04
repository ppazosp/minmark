#!/bin/bash
set -euo pipefail

APP_NAME="Minmark"
BUNDLE_DIR="src-tauri/target/release/bundle/macos"
APP_PATH="$BUNDLE_DIR/$APP_NAME.app"
PLIST_PATH="$APP_PATH/Contents/Info.plist"

echo "Patching Info.plist with CFBundleIconName..."
/usr/libexec/PlistBuddy -c "Add :CFBundleIconName string AppIcon" "$PLIST_PATH" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Set :CFBundleIconName AppIcon" "$PLIST_PATH"

echo "Installing to /Applications..."
rm -rf "/Applications/$APP_NAME.app"
cp -R "$APP_PATH" /Applications/

echo "$APP_NAME installed to /Applications"
