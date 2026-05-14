#!/usr/bin/env bash
set -euo pipefail

if [ -f "data/raw/tarot_json/tarot-images.json" ]; then
  echo "Dataset already present at data/raw/tarot_json"
  exit 0
fi

echo "Tarot dataset not found. Please place tarot-json files under data/raw/tarot_json"
exit 1
