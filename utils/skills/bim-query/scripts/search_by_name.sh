#!/bin/bash
# Search for object types by partial name match (case-insensitive)
# Usage: search_by_name.sh "keyword"
# Output format: CATEGORY|ObjectType|Count

SEARCH_TERM=$1

if [ -z "$SEARCH_TERM" ]; then
  echo "Usage: $0 <search_term>" >&2
  exit 1
fi

if [ ! -f "schema/object_types.json" ]; then
  echo "Error: schema/object_types.json not found" >&2
  exit 1
fi

jq -r --arg term "$SEARCH_TERM" \
  'map(select(.objectType | ascii_downcase | contains($term | ascii_downcase))) | 
   .[] | "\(.category)|\(.objectType)|\(.count)"' \
  schema/object_types.json
