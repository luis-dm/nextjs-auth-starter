#!/usr/bin/env bash
# Generate a descriptive summary of BIM elements

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
CATEGORY=""
STOREY=""
PATTERN=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --storey)
      STOREY="$2"
      shift 2
      ;;
    --pattern)
      PATTERN="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Determine source file
if [ -n "$CATEGORY" ] && [ -n "$STOREY" ]; then
  ELEMENTS=$(jq --arg storey "$STOREY" 'select(.storeySlug == $storey)' \
    "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null)
elif [ -n "$CATEGORY" ]; then
  ELEMENTS=$(cat "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null)
elif [ -n "$STOREY" ]; then
  ELEMENTS=$(cat "$BIM_FS/index/by_storey/$STOREY.jsonl" 2>/dev/null)
else
  ELEMENTS=$(cat "$BIM_FS/flat/elements.jsonl" 2>/dev/null)
fi

# Apply pattern filter if specified
if [ -n "$PATTERN" ]; then
  ELEMENTS=$(echo "$ELEMENTS" | jq --arg pattern "$PATTERN" \
    'select(.name | ascii_downcase | contains($pattern | ascii_downcase))')
fi

# Generate summary
echo "$ELEMENTS" | jq -s '
  {
    total_count: length,
    by_category: (group_by(.category) | map({
      category: .[0].category,
      count: length,
      sample_names: [.[0:3][].name]
    })),
    by_storey: (group_by(.storeySlug) | map({
      storey: .[0].storey,
      count: length
    })),
    by_object_type: (group_by(.objectType) | map({
      type: .[0].objectType,
      count: length
    }) | sort_by(-.count) | .[0:10]),
    sample_elements: [.[0:5] | .[] | {
      id: .id,
      name: .name,
      category: .category,
      storey: .storey
    }]
  }
'
