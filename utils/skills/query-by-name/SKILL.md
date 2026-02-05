---
name: query-by-name
description: Find BIM elements by searching their names (e.g., "Chair", "Table", "Door-123")
version: 1.0.0
tags:
  - bim
  - query
  - search
---

# Query by Element Name

Searches for BIM elements by their name property using pattern matching.

## Usage

This skill helps answer queries like:
- "Get me the IDs of chairs"
- "Find all elements with 'Chair-Breuer' in their name"
- "Show me tables"
- "List doors named '163541'"

## Process

1. Extract search pattern from user query
2. Use `scripts/search_by_name.sh` to search through all elements
3. Return matching elements with their IDs, categories, and locations

## Files Used

- `bim_fs/flat/elements.jsonl` - All elements in JSONL format
- `bim_fs/index/by_category/*.jsonl` - Category-specific searches

## Example

Query: "get me the ids of chairs"
- Pattern: "Chair" (case-insensitive)
- Search through flat/elements.jsonl
- Results: All elements with "Chair" in their name
