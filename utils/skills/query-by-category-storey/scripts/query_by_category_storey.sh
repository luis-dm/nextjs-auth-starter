#!/usr/bin/env bash
# Query BIM elements by category and/or storey

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
CATEGORY=""
STOREY=""

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
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$CATEGORY" ] && [ -z "$STOREY" ]; then
  echo "Error: Must specify at least --category or --storey" >&2
  exit 1
fi

# Query by both category and storey
if [ -n "$CATEGORY" ] && [ -n "$STOREY" ]; then
  cat "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null | \
    jq --arg storey "$STOREY" 'select(.storeySlug == $storey)'
  
# Query by category only
elif [ -n "$CATEGORY" ]; then
  cat "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null || true
  
# Query by storey only
elif [ -n "$STOREY" ]; then
  cat "$BIM_FS/index/by_storey/$STOREY.jsonl" 2>/dev/null || true
fi
