#!/bin/bash
# Get all element IDs for a specific object type
# Usage: get_ids_by_object_type.sh "ObjectType"

OBJECT_TYPE=$1

if [ -z "$OBJECT_TYPE" ]; then
  echo "Usage: $0 <object_type>" >&2
  exit 1
fi

# Find which category this object type belongs to
CATEGORY=$(jq -r --arg ot "$OBJECT_TYPE" \
  '.[] | select(.objectType == $ot) | .category' \
  schema/object_types.json | head -1)

if [ -z "$CATEGORY" ]; then
  echo "Error: Object type not found: $OBJECT_TYPE" >&2
  exit 1
fi

FILE="index/by_category/${CATEGORY}.jsonl"

if [ ! -f "$FILE" ]; then
  echo "Error: Category file not found: $FILE" >&2
  exit 1
fi

# Extract IDs from the category file matching the object type
jq -r --arg ot "$OBJECT_TYPE" \
  'select(.ObjectType == $ot) | ._localId' \
  "$FILE"
