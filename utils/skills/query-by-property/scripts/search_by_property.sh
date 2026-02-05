#!/usr/bin/env bash
# Search BIM elements by property name or value

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
PROPERTY=""
VALUE=""
CATEGORY=""
STOREY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --property)
      PROPERTY="$2"
      shift 2
      ;;
    --value)
      VALUE="$2"
      shift 2
      ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --storey)
      STOREY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$PROPERTY" ]; then
  echo "Error: --property is required" >&2
  echo "Usage: $0 --property <property_name> [--value <value>] [--category <cat>] [--storey <storey>]" >&2
  exit 1
fi

# Build element ID list based on filters
if [ -n "$CATEGORY" ] && [ -n "$STOREY" ]; then
  IDS=$(jq -r --arg storey "$STOREY" 'select(.storeySlug == $storey) | .id' \
    "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null || true)
elif [ -n "$CATEGORY" ]; then
  IDS=$(jq -r '.id' "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null || true)
elif [ -n "$STOREY" ]; then
  IDS=$(jq -r '.id' "$BIM_FS/index/by_storey/$STOREY.jsonl" 2>/dev/null || true)
else
  IDS=$(jq -r '.id' "$BIM_FS/flat/elements.jsonl" 2>/dev/null || true)
fi

# Search through elements for the property
for id in $IDS; do
  file="$BIM_FS/raw/by_id/$id.json"
  if [ ! -f "$file" ]; then
    continue
  fi
  
  # Check if property exists and optionally matches value
  if [ -n "$VALUE" ]; then
    jq --arg prop "$PROPERTY" --arg val "$VALUE" \
      'select(has($prop) and (.[$prop] | tostring | ascii_downcase | contains($val | ascii_downcase)))' \
      "$file" 2>/dev/null || true
  else
    jq --arg prop "$PROPERTY" \
      'select(has($prop)) | {id: ._localId, category: ._category, ($prop): .[$prop]}' \
      "$file" 2>/dev/null || true
  fi
done
