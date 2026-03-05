#!/bin/bash
# Check what properties are available for a category
# Usage: check_properties.sh IFCDOOR

CATEGORY=$1

if [ -z "$CATEGORY" ]; then
  echo "Usage: $0 <CATEGORY>" >&2
  exit 1
fi

FILE="schema/keys_by_category/${CATEGORY}.json"

if [ ! -f "$FILE" ]; then
  echo "{\"error\": \"Category ${CATEGORY} not found in schema\"}"
  exit 1
fi

# Sort properties by frequency (most common first)
jq 'to_entries | map({property: .key, count: .value}) | sort_by(-.count)' "$FILE"
