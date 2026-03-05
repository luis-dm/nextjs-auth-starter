#!/bin/bash
# Fast count of elements on a storey
# Usage: count_storey.sh nivel_1

STOREY=$1

if [ -z "$STOREY" ]; then
  echo "Usage: $0 <STOREY_SLUG>" >&2
  exit 1
fi

FILE="index/by_storey/${STOREY}.jsonl"

if [ ! -f "$FILE" ]; then
  echo "0"
  exit 0
fi

wc -l < "$FILE" | tr -d ' '
