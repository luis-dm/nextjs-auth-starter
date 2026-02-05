#!/usr/bin/env bash
# Match keywords to categories and storeys in the BIM schema

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
KEYWORDS="$*"

if [ -z "$KEYWORDS" ]; then
  echo "Usage: $0 <keyword1> [keyword2] ..." >&2
  exit 1
fi

# Function to match categories
match_categories() {
  local pattern="$1"
  if [ ! -f "$BIM_FS/schema/categories.json" ]; then
    echo "Error: categories.json not found" >&2
    return 1
  fi
  
  # Case-insensitive grep through categories
  jq -r '.[].category' "$BIM_FS/schema/categories.json" | grep -i "$pattern" || true
}

# Function to match storeys
match_storeys() {
  local pattern="$1"
  if [ ! -f "$BIM_FS/schema/storeys.json" ]; then
    echo "Error: storeys.json not found" >&2
    return 1
  fi
  
  # Search in name, slug, and aliases
  jq -r --arg pattern "$pattern" '
    .[] | 
    select(
      (.name | ascii_downcase | contains($pattern | ascii_downcase)) or
      (.slug | ascii_downcase | contains($pattern | ascii_downcase)) or
      (.aliases[]? | ascii_downcase | contains($pattern | ascii_downcase))
    ) | 
    .slug
  ' "$BIM_FS/schema/storeys.json" | head -1 || true
}

echo "{"
echo "  \"categories\": ["

FIRST=true
for keyword in $KEYWORDS; do
  matched=$(match_categories "$keyword")
  if [ -n "$matched" ]; then
    while IFS= read -r cat; do
      if [ "$FIRST" = true ]; then
        FIRST=false
      else
        echo ","
      fi
      echo -n "    \"$cat\""
    done <<< "$matched"
  fi
done

echo ""
echo "  ],"
echo "  \"storeys\": ["

FIRST=true
for keyword in $KEYWORDS; do
  matched=$(match_storeys "$keyword")
  if [ -n "$matched" ]; then
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      echo ","
    fi
    echo -n "    \"$matched\""
  fi
done

echo ""
echo "  ]"
echo "}"
