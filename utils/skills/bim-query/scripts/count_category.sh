#!/bin/bash
# Fast count of elements in a category
# Usage: count_category.sh IFCDOOR

CATEGORY=$1

if [ -z "$CATEGORY" ]; then
  echo "Usage: $0 <CATEGORY>" >&2
  exit 1
fi

FILE="index/by_category/${CATEGORY}.jsonl"

if [ ! -f "$FILE" ]; then
  echo "0"
  exit 0
fi

wc -l < "$FILE" | tr -d ' '
