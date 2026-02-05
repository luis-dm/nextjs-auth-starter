---
name: get-element-properties
description: Retrieve all properties of specific BIM elements by their IDs or filtered selection
version: 1.0.0
tags:
  - bim
  - properties
  - details
---

# Get Element Properties

Retrieves the complete property set for BIM elements.

## Usage

This skill helps answer queries like:
- "Show me the properties of element 22492"
- "What are the properties of second floor windows?"
- "List all properties of doors on Nivel 1"
- "Get details for chair elements"

## Process

1. Identify elements (by ID, category/storey, or name search)
2. Use `scripts/get_properties.sh` to fetch full element data
3. Return complete property sets for each element

## Files Used

- `bim_fs/raw/by_id/*.json` - Full element data by ID
- Combined with other skills to first find element IDs

## Example

Query: "properties of second floor windows"
1. First use query-by-category-storey to find window IDs on floor 2
2. Then fetch full properties for each ID
3. Return complete property data
