---
name: query-by-property
description: Find BIM elements based on specific property values (e.g., fire rating, material, area)
version: 1.0.0
tags:
  - bim
  - properties
  - filter
---

# Query by Property

Searches for BIM elements that have specific properties or property values.

## Usage

This skill helps answer queries like:
- "What is the fire rating of doors?"
- "Show me elements with area greater than 10"
- "Find windows with OverallHeight"
- "Which elements have a fire rating property?"

## Process

1. Identify the property to search for
2. Optionally filter by category/storey first for performance
3. Use `scripts/search_by_property.sh` to search through element properties
4. Return matching elements with their property values

## Files Used

- `bim_fs/raw/by_id/*.json` - Full element data
- `bim_fs/schema/keys_by_category/*.json` - Property keys per category
- `bim_fs/schema/keys_global.json` - All available property keys

## Example

Query: "fire rating of doors"
1. Filter to IFCDOOR category
2. Search for "FireRating" or similar property keys
3. Return doors with their fire rating values
