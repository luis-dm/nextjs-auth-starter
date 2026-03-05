#!/bin/bash
# Get all IDs in a specific category
# Usage: ./get_ids_by_category.sh IFCDOOR

CATEGORY="$1"

if [ -z "$CATEGORY" ]; then
  echo "Usage: $0 <CATEGORY>"
  echo "Example: $0 IFCDOOR"
  exit 1
fi

FILE="index/by_category/${CATEGORY}.jsonl"

if [ ! -f "$FILE" ]; then
  echo "Error: Category file not found: $FILE"
  echo "Available categories:"
  ls index/by_category/ | sed 's/.jsonl$//'
  exit 1
fi

grep -oE '"_localId":[0-9]+' "$FILE" | cut -d: -f2
