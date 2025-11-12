#!/usr/bin/env bash
#
# Download minimal Liberation Serif fonts for resume generation
# From Fedora Project (original creators)

set -e

FONTS_DIR="$(dirname "$0")/fonts"

echo "📥 Downloading Liberation Serif fonts from Fedora mirrors..."

# Download from Fedora CDN (original maintainers)
# These are the actual TTF files, not HTML wrappers
curl -sL "https://releases.pagure.org/liberation-fonts/liberation-fonts-ttf-2.1.4.tar.gz" \
  -o /tmp/liberation-fonts.tar.gz

# Extract just the Serif fonts we need
tar -xzf /tmp/liberation-fonts.tar.gz \
  -C /tmp \
  --strip-components=1 \
  liberation-fonts-ttf-2.1.4/LiberationSerif-Regular.ttf \
  liberation-fonts-ttf-2.1.4/LiberationSerif-Bold.ttf

# Move to fonts directory
mv /tmp/LiberationSerif-Regular.ttf "$FONTS_DIR/"
mv /tmp/LiberationSerif-Bold.ttf "$FONTS_DIR/"

# Cleanup
rm /tmp/liberation-fonts.tar.gz

echo "✅ Fonts downloaded:"
file "$FONTS_DIR"/LiberationSerif-*.ttf
ls -lh "$FONTS_DIR"/LiberationSerif-*.ttf

echo ""
echo "Total size:"
du -sh "$FONTS_DIR"
