---
name: describe-selection
description: Provide a descriptive summary of a selection of BIM elements including counts, categories, locations, and key properties
version: 1.0.0
tags:
  - bim
  - summary
  - description
---

# Describe Selection

Generates a comprehensive description of a selection of BIM elements.

## Usage

This skill helps answer queries like:
- "Describe the first floor elements"
- "Summarize all windows in the building"
- "What can you tell me about the doors on Nivel 1?"
- "Give me an overview of furniture elements"

## Process

1. Identify the selection criteria
2. Gather elements matching criteria
3. Use `scripts/describe_selection.sh` to generate summary including:
   - Total count
   - Category breakdown
   - Storey distribution
   - Common properties
   - Value ranges for numeric properties
   - Sample elements

## Files Used

- All index and raw files for comprehensive analysis
- `bim_fs/schema/*.json` - For context and property information

## Example

Query: "describe the first floor elements"

Output:
```
First Floor (Nivel 1) contains 157 elements:
- 3 Walls (IFCWALLSTANDARDCASE)
- 9 Windows (IFCWINDOW)
- 35 Furniture items (IFCFURNISHINGELEMENT)
- 1 Door (IFCDOOR)
- 1 Slab (IFCSLAB)
- 108 Curtain wall components (IFCCURTAINWALL)

Windows: 9 elements with areas ranging from X to Y m²
Furniture: Includes 20 chairs, 5 tables
...
```
