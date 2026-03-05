#!/bin/bash
# Get elements matching both category AND storey (intersection)
# Usage: ./intersection.sh IFCWINDOW nivel_1

CATEGORY="$1"
STOREY_SLUG="$2"

if [ -z "$CATEGORY" ] || [ -z "$STOREY_SLUG" ]; then
  echo "Usage: $0 <CATEGORY> <STOREY_SLUG>"
  echo "Example: $0 IFCWINDOW nivel_1"
  exit 1
fi

FILE="index/by_category/${CATEGORY}.jsonl"

if [ ! -f "$FILE" ]; then
  echo "Error: Category file not found: $FILE"
  echo "Available categories:"
  ls index/by_category/ | sed 's/.jsonl$//'
  exit 1
fi

# Filter by storey slug
# Fast intersection: grep for storey, then extract IDs
grep "\"storeySlug\":\"$STOREY\"" "$FILE" | grep -oE '"_localId":[0-9]+' | cut -d: -f2
