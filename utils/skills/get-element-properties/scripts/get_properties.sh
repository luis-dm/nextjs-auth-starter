#!/usr/bin/env bash
# Get full properties for BIM elements by ID

set -euo pipefail

BIM_FS="${BIM_FS:-./bim_fs}"
IDS=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --id)
      IDS+=("$2")
      shift 2
      ;;
    --ids)
      # Accept comma-separated list
      IFS=',' read -ra ADDR <<< "$2"
      for id in "${ADDR[@]}"; do
        IDS+=("$id")
      done
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [ ${#IDS[@]} -eq 0 ]; then
  echo "Error: Must specify at least one --id" >&2
  echo "Usage: $0 --id <element_id> [--id <element_id>] or --ids <id1,id2,id3>" >&2
  exit 1
fi

# Fetch properties for each element
for id in "${IDS[@]}"; do
  file="$BIM_FS/raw/by_id/$id.json"
  if [ -f "$file" ]; then
    cat "$file"
  else
    echo "{\"error\": \"Element $id not found\"}" >&2
  fi
done
