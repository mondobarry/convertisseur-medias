#!/bin/bash
# Makes the Homebrew ffmpeg/ffprobe self-contained for binaries/arm64/:
# copies every Homebrew dylib they need into binaries/arm64/libs, rewrites the
# load paths to @executable_path/libs and re-signs everything (ad-hoc).
# The result runs on Apple Silicon Macs without Homebrew, on the macOS version
# the Homebrew bottles target (see "minos" printed at the end) or later.
#
# Usage: brew install ffmpeg dylibbundler && scripts/bundle-ffmpeg.sh
set -euo pipefail

cd "$(dirname "$0")/.."
BREW_PREFIX="$(brew --prefix)"
OUT="binaries/arm64"
LIBS="$OUT/libs"

command -v dylibbundler >/dev/null || { echo "dylibbundler manquant : brew install dylibbundler" >&2; exit 1; }
[ -x "$BREW_PREFIX/bin/ffmpeg" ] || { echo "ffmpeg manquant : brew install ffmpeg" >&2; exit 1; }

rm -rf "$OUT"
mkdir -p "$LIBS"
for bin in ffmpeg ffprobe; do
  cp "$(realpath "$BREW_PREFIX/bin/$bin")" "$OUT/$bin"
  chmod u+w "$OUT/$bin"
done

dylibbundler --overwrite-dir --bundle-deps --create-dir \
  --fix-file "$OUT/ffmpeg" --fix-file "$OUT/ffprobe" \
  --dest-dir "$LIBS" --install-path @executable_path/libs/ \
  --search-path "$BREW_PREFIX/lib" >/dev/null

# Any change to a Mach-O invalidates its signature; Apple Silicon refuses to run unsigned code
for f in "$LIBS"/*.dylib "$OUT/ffmpeg" "$OUT/ffprobe"; do
  codesign --force --sign - "$f" 2>/dev/null
done

# Fail if anything still points into Homebrew
if otool -L "$OUT/ffmpeg" "$OUT/ffprobe" "$LIBS"/*.dylib | grep -q "$BREW_PREFIX"; then
  echo "Des références à $BREW_PREFIX subsistent :" >&2
  otool -L "$OUT/ffmpeg" "$OUT/ffprobe" "$LIBS"/*.dylib | grep "$BREW_PREFIX" >&2
  exit 1
fi

"$OUT/ffmpeg" -hide_banner -version | head -1
echo "$(ls "$LIBS" | wc -l | tr -d ' ') bibliothèques, $(du -sh "$OUT" | cut -f1) au total"
echo "macOS minimum : $(otool -l "$OUT/ffmpeg" | awk '/minos/ {print $2; exit}')"
