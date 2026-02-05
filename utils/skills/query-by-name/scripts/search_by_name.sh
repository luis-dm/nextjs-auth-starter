#!/usr/bin/env bash
# Search BIM elements by name pattern

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
PATTERN=""
CATEGORY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --pattern)
      PATTERN="$2"
      shift 2
      ;;
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$PATTERN" ]; then
  echo "Error: --pattern is required" >&2
  echo "Usage: $0 --pattern <search_pattern> [--category <category>]" >&2
  exit 1
fi

# Search in specific category or all elements
if [ -n "$CATEGORY" ]; then
  SOURCE="$BIM_FS/index/by_category/$CATEGORY.jsonl"
else
  SOURCE="$BIM_FS/flat/elements.jsonl"
fi

if [ ! -f "$SOURCE" ]; then
  echo "Error: Source file not found: $SOURCE" >&2
  exit 1
fi

# Case-insensitive search through name field
jq --arg pattern "$PATTERN" '
  select(.name | ascii_downcase | contains($pattern | ascii_downcase))
' "$SOURCE"
