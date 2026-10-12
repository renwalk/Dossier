#!/bin/sh
# Refresh projects/bird-box/ from the BirdBox repo next door.
# BirdBox stays the source of truth — edit it there, then run this.
#   sh tools/sync-birdbox.sh
set -e
cd "$(dirname "$0")/.."
rsync -a --delete \
  --exclude='.git' --exclude='.claude' --exclude='.DS_Store' --exclude='.gitignore' \
  ../BirdBox/ projects/bird-box/
echo "projects/bird-box/ synced from ../BirdBox"
