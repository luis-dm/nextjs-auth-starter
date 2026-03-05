#!/bin/bash
# List all object types, optionally filtered by category
# Usage: list_object_types.sh [CATEGORY]

CATEGORY=${1:-}

if [ ! -f "schema/object_types.json" ]; then
  echo "Error: schema/object_types.json not found" >&2
  exit 1
fi

if [ -z "$CATEGORY" ]; then
  # Show all
  jq -r '.[] | "\(.objectType) (\(.category)): \(.count)"' schema/object_types.json
else
  # Filter by category
  jq -r --arg cat "$CATEGORY" \
    '.[] | select(.category == $cat) | "\(.objectType): \(.count)"' \
    schema/object_types.json
fi
