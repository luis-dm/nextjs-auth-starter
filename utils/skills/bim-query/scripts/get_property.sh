#!/bin/bash
# Get a specific property from all elements in a category
# Usage: ./get_property.sh IFCWINDOW OverallWidth

CATEGORY="$1"
PROPERTY="$2"

if [ -z "$CATEGORY" ] || [ -z "$PROPERTY" ]; then
  echo "Usage: $0 <CATEGORY> <PROPERTY>"
  echo "Example: $0 IFCWINDOW OverallWidth"
  exit 1
fi

FILE="index/by_category/${CATEGORY}.jsonl"

if [ ! -f "$FILE" ]; then
  echo "Error: Category file not found: $FILE"
  echo "Available categories:"
  ls index/by_category/ | sed 's/.jsonl$//'
  exit 1
fi

# Output as JSON objects with id and the requested property
jq -c "{id: ._localId, name: .Name, value: .$PROPERTY}" "$FILE"
