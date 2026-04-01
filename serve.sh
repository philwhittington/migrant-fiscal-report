#!/bin/bash
# Serve the built migrant fiscal report locally for preview
# Usage: ./serve.sh
# Then open http://localhost:4200

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/dist/public"

if [ ! -d "$BUILD_DIR" ]; then
  echo "Build directory not found. Run 'npm run build' first."
  exit 1
fi

echo "Serving migrant fiscal report from $BUILD_DIR"
echo "Open http://localhost:4200 in your browser"
echo ""

npx serve "$BUILD_DIR" -l 4200
