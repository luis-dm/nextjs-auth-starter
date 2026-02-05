---
name: compute-property
description: Calculate or derive property values (e.g., area from width/height, totals, aggregations)
version: 1.0.0
tags:
  - bim
  - calculation
  - aggregation
---

# Compute Property

Calculates derived values from element properties, including handling missing properties by computing from related values.

## Usage

This skill helps answer queries like:
- "What is the total area of first floor windows?"
- "Calculate the area of windows" (when only width/height exist)
- "Sum the areas of all doors"
- "What's the average height of windows?"

## Process

1. Identify elements to compute for (using other skills)
2. Determine the target property and calculation method
3. Use `scripts/compute_property.sh` to calculate values
4. Handle edge cases:
   - Missing area → compute from width × height
   - Missing dimensions → report as unavailable
   - Aggregate calculations (sum, avg, min, max, count)

## Files Used

- `bim_fs/raw/by_id/*.json` - Element properties
- `references/property-mappings.json` - Common property aliases

## Example

Query: "what is the area of first floor windows"
1. Find first floor windows
2. Check for Area property
3. If missing, look for OverallWidth × OverallHeight
4. Sum all calculated areas
5. Return total with units
