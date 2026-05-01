#!/bin/bash
# Script to create PWA icons from SVG
# This requires ImageMagick or similar tool to be installed

# Check if convert (ImageMagick) is available
if command -v convert &> /dev/null; then
    echo "Creating icons using ImageMagick..."
    convert -background none public/icon.svg -resize 192x192 public/icon-192x192.png
    convert -background none public/icon.svg -resize 512x512 public/icon-512x512.png
    convert -background none public/icon.svg -resize 180x180 public/apple-touch-icon.png
    echo "Icons created successfully!"
else
    echo "ImageMagick not found. Icons need to be created manually."
    echo "Please use an online converter or design tool to create:"
    echo "  - icon-192x192.png (192x192)"
    echo "  - icon-512x512.png (512x512)"
    echo "  - apple-touch-icon.png (180x180)"
fi
