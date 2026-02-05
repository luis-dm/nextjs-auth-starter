#!/usr/bin/env bash
# Count BIM elements by various criteria

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
CATEGORY=""
STOREY=""
PATTERN=""
BREAKDOWN=""

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
    --breakdown)
      BREAKDOWN="$2"  # "category", "storey", "both"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Simple count with filters
if [ -z "$BREAKDOWN" ]; then
  if [ -n "$CATEGORY" ] && [ -n "$STOREY" ]; then
    COUNT=$(jq --arg storey "$STOREY" 'select(.storeySlug == $storey)' \
      "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null | wc -l | tr -d ' ')
    echo "{\"count\": $COUNT, \"category\": \"$CATEGORY\", \"storey\": \"$STOREY\"}"
    
  elif [ -n "$CATEGORY" ]; then
    if [ -n "$PATTERN" ]; then
      COUNT=$(jq --arg pattern "$PATTERN" \
        'select(.name | ascii_downcase | contains($pattern | ascii_downcase))' \
        "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null | wc -l | tr -d ' ')
    else
      COUNT=$(wc -l < "$BIM_FS/index/by_category/$CATEGORY.jsonl" 2>/dev/null | tr -d ' ')
    fi
    echo "{\"count\": $COUNT, \"category\": \"$CATEGORY\"}"
    
  elif [ -n "$STOREY" ]; then
    if [ -n "$PATTERN" ]; then
      COUNT=$(jq --arg pattern "$PATTERN" \
        'select(.name | ascii_downcase | contains($pattern | ascii_downcase))' \
        "$BIM_FS/index/by_storey/$STOREY.jsonl" 2>/dev/null | wc -l | tr -d ' ')
    else
      COUNT=$(wc -l < "$BIM_FS/index/by_storey/$STOREY.jsonl" 2>/dev/null | tr -d ' ')
    fi
    echo "{\"count\": $COUNT, \"storey\": \"$STOREY\"}"
    
  elif [ -n "$PATTERN" ]; then
    COUNT=$(jq --arg pattern "$PATTERN" \
      'select(.name | ascii_downcase | contains($pattern | ascii_downcase))' \
      "$BIM_FS/flat/elements.jsonl" 2>/dev/null | wc -l | tr -d ' ')
    echo "{\"count\": $COUNT, \"pattern\": \"$PATTERN\"}"
    
  else
    COUNT=$(wc -l < "$BIM_FS/flat/elements.jsonl" 2>/dev/null | tr -d ' ')
    echo "{\"count\": $COUNT, \"total\": true}"
  fi

# Breakdown by category and/or storey
else
  case $BREAKDOWN in
    category)
      jq -r '.category' "$BIM_FS/flat/elements.jsonl" | sort | uniq -c | \
        awk '{print "{\"category\": \""$2"\", \"count\": "$1"}"}'
      ;;
    storey)
      jq -r '.storeySlug' "$BIM_FS/flat/elements.jsonl" | sort | uniq -c | \
        awk '{print "{\"storey\": \""$2"\", \"count\": "$1"}"}'
      ;;
    both)
      jq -r '[.category, .storeySlug] | @tsv' "$BIM_FS/flat/elements.jsonl" | \
        sort | uniq -c | \
        awk '{print "{\"category\": \""$2"\", \"storey\": \""$3"\", \"count\": "$1"}"}'
      ;;
  esac
fi
