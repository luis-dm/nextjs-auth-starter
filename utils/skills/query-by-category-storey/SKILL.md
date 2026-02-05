---
name: query-by-category-storey
description: Find BIM elements by their category (e.g., IFCDOOR, IFCWINDOW) and/or building storey (e.g., first floor, nivel 1)
version: 1.0.0
tags:
  - bim
  - query
  - filter
---

# Query by Category and Storey

Finds BIM elements based on their IFC category and/or building storey location.

## Usage

This skill helps answer queries like:
- "Show me all doors on the first floor"
- "List windows in Nivel 1"
- "Get all IFCFURNISHINGELEMENT on the second floor"
- "Find chairs on level 1"

## Process

1. Extract category and/or storey from user query
2. Use `scripts/match_schema.sh` to find matching categories and storeys in the schema
3. Use `scripts/query_by_category_storey.sh` to retrieve matching elements
4. Return results with element IDs, names, and locations

## Schema Files Used

- `bim_fs/schema/categories.json` - List of all available categories
- `bim_fs/schema/storeys.json` - List of all storeys with aliases
- `bim_fs/index/by_category/*.jsonl` - Elements indexed by category
- `bim_fs/index/by_storey/*.jsonl` - Elements indexed by storey

## Example

Query: "first floor doors"
- Category: IFCDOOR (from schema)
- Storey: nivel_1 (matched via aliases: first_floor, level_1, etc.)
- Results: All door elements on Nivel 1
