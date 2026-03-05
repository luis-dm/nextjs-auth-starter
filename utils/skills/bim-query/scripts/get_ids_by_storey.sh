#!/bin/bash
# Get all IDs on a specific storey
# Usage: ./get_ids_by_storey.sh nivel_1

STOREY_SLUG="$1"

if [ -z "$STOREY_SLUG" ]; then
  echo "Usage: $0 <STOREY_SLUG>"
  echo "Example: $0 nivel_1"
  exit 1
fi

FILE="index/by_storey/${STOREY_SLUG}.jsonl"

if [ ! -f "$FILE" ]; then
  echo "Error: Storey file not found: $FILE"
  echo "Available storeys:"
  ls index/by_storey/ | sed 's/.jsonl$//'
  exit 1
fi

grep -oE '"_localId":[0-9]+' "$FILE" | cut -d: -f2
