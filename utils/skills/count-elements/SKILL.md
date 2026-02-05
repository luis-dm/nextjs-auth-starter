---
name: count-elements
description: Count BIM elements by category, storey, name pattern, or other criteria
version: 1.0.0
tags:
  - bim
  - count
  - statistics
---

# Count Elements

Counts BIM elements matching specified criteria.

## Usage

This skill helps answer queries like:
- "How many doors are on the first floor?"
- "Count all windows in the building"
- "How many chair elements are there?"
- "What's the count of IFCFURNISHINGELEMENT on Nivel 1?"

## Process

1. Identify filtering criteria (category, storey, name, property)
2. Use `scripts/count_elements.sh` to count matching elements
3. Return count with breakdown by category and/or storey if requested

## Files Used

- `bim_fs/flat/elements.jsonl` - All elements
- `bim_fs/index/by_category/*.jsonl` - Category indexes
- `bim_fs/index/by_storey/*.jsonl` - Storey indexes
- `bim_fs/schema/categories.json` - Category counts

## Example

Query: "how many doors on the first floor"
1. Match "doors" → IFCDOOR category
2. Match "first floor" → nivel_1 storey
3. Count elements in both filters
4. Return: "X doors found on first floor"
