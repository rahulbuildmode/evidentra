#!/bin/sh
# Renders every HTML file in this folder to PDF with a headless Chromium browser (Brave or Chrome).
cd "$(dirname "$0")"
B="${BROWSER_BIN:-/Applications/Brave Browser.app/Contents/MacOS/Brave Browser}"
for f in *.html; do
  "$B" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${f%.html}.pdf" "file://$PWD/$f" >/dev/null 2>&1
done
