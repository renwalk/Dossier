#!/bin/sh
# Refresh projects/moonflower/ from the kaliedoscope-moonflower repo next door.
# That repo stays the source of truth — edit it there, then run this.
#   sh tools/sync-moonflower.sh
set -e
cd "$(dirname "$0")/.."
mkdir -p projects/moonflower
rsync -a --delete \
  --exclude='.git' --exclude='.claude' --exclude='.DS_Store' --exclude='.gitignore' \
  ../kaliedoscope-moonflower/moon-flower/ projects/moonflower/
echo "projects/moonflower/ synced from ../kaliedoscope-moonflower/moon-flower"
