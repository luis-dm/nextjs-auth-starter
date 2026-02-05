#!/usr/bin/env bash
# Compute or aggregate property values from BIM elements

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
PROPERTY=""
OPERATION="list"  # list, sum, avg, min, max, count
IDS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --property)
      PROPERTY="$2"
      shift 2
      ;;
    --operation)
      OPERATION="$2"
      shift 2
      ;;
    --ids)
      IFS=',' read -ra IDS <<< "$2"
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
  exit 1
fi

if [ ${#IDS[@]} -eq 0 ]; then
  echo "Error: --ids is required" >&2
  exit 1
fi

# Build JQ script based on operation
case $OPERATION in
  list)
    for id in "${IDS[@]}"; do
      file="$BIM_FS/raw/by_id/$id.json"
      [ ! -f "$file" ] && continue
      
      # Try direct property, then try to compute from width/height for area
      jq --arg prop "$PROPERTY" --arg id "$id" '
        if has($prop) then
          {id: $id, value: .[$prop], computed: false}
        elif ($prop | ascii_downcase) == "area" then
          if has("OverallWidth") and has("OverallHeight") then
            {id: $id, value: (.OverallWidth * .OverallHeight), computed: true, formula: "OverallWidth × OverallHeight"}
          elif has("Width") and has("Height") then
            {id: $id, value: (.Width * .Height), computed: true, formula: "Width × Height"}
          else
            {id: $id, value: null, error: "Cannot compute area: missing dimensions"}
          end
        else
          {id: $id, value: null, error: "Property not found"}
        end
      ' "$file" 2>/dev/null || true
    done
    ;;
    
  sum|avg|min|max|count)
    # Collect all values first
    VALUES=()
    for id in "${IDS[@]}"; do
      file="$BIM_FS/raw/by_id/$id.json"
      [ ! -f "$file" ] && continue
      
      val=$(jq --arg prop "$PROPERTY" '
        if has($prop) then
          .[$prop]
        elif ($prop | ascii_downcase) == "area" then
          if has("OverallWidth") and has("OverallHeight") then
            .OverallWidth * .OverallHeight
          elif has("Width") and has("Height") then
            .Width * .Height
          else
            null
          end
        else
          null
        end
      ' "$file" 2>/dev/null || echo "null")
      
      if [ "$val" != "null" ]; then
        VALUES+=("$val")
      fi
    done
    
    # Perform aggregation
    if [ ${#VALUES[@]} -eq 0 ]; then
      echo "{\"error\": \"No valid values found for $PROPERTY\"}"
      exit 1
    fi
    
    case $OPERATION in
      sum)
        printf '%s\n' "${VALUES[@]}" | jq -s 'add'
        ;;
      avg)
        printf '%s\n' "${VALUES[@]}" | jq -s 'add / length'
        ;;
      min)
        printf '%s\n' "${VALUES[@]}" | jq -s 'min'
        ;;
      max)
        printf '%s\n' "${VALUES[@]}" | jq -s 'max'
        ;;
      count)
        echo "${#VALUES[@]}"
        ;;
    esac
    ;;
esac
