# Common Query Patterns

This document provides example queries for common BIM questions.

## Counting Queries

### Count all elements in a category
```bash
wc -l < index/by_category/IFCDOOR.jsonl
```

### Count all elements on a storey
```bash
wc -l < index/by_storey/nivel_1.jsonl
```

### Count elements matching both category AND storey
```bash
jq 'select(.storeySlug == "nivel_1")' index/by_category/IFCWINDOW.jsonl | wc -l
```

### Count all elements in the model
```bash
wc -l < flat/elements.jsonl
```

## ID Extraction

### Get all IDs in a category
```bash
jq -r '._localId' index/by_category/IFCDOOR.jsonl
```

### Get all IDs on a storey
```bash
jq -r '._localId' index/by_storey/nivel_1.jsonl
```

### Get IDs matching intersection (category + storey)
```bash
jq -r 'select(.storeySlug == "nivel_1") | ._localId' index/by_category/IFCWINDOW.jsonl
```

## Property Extraction

### Get a specific property from all elements in a category
```bash
# Just the property value
jq -r '.OverallWidth' index/by_category/IFCWINDOW.jsonl

# With context (id + property)
jq -r '{id: ._localId, width: .OverallWidth}' index/by_category/IFCWINDOW.jsonl
```

### Get multiple properties
```bash
jq '{id: ._localId, name: .Name, width: .OverallWidth, height: .OverallHeight}' index/by_category/IFCWINDOW.jsonl
```

### Get properties from intersection
```bash
# Dimensions of windows on nivel_1
jq 'select(.storeySlug == "nivel_1") | {id: ._localId, width: .OverallWidth, height: .OverallHeight}' index/by_category/IFCWINDOW.jsonl
```

## Filtering Queries

### Filter by property value
```bash
# Windows wider than 1 meter
jq 'select(.OverallWidth > 1)' index/by_category/IFCWINDOW.jsonl

# Windows exactly 1 meter wide
jq 'select(.OverallWidth == 1)' index/by_category/IFCWINDOW.jsonl
```

### Filter with multiple conditions
```bash
# Large windows on nivel_1
jq 'select(.storeySlug == "nivel_1" and .OverallWidth >= 1 and .OverallHeight >= 2)' index/by_category/IFCWINDOW.jsonl
```

### Filter by name pattern
```bash
# Elements with "Breuer" in the name
jq 'select(.Name | contains("Breuer"))' flat/elements.jsonl
```

## Aggregation Queries

### Sum of a property
```bash
# Total width of all windows
jq -s 'map(.OverallWidth) | add' index/by_category/IFCWINDOW.jsonl
```

### Average of a property
```bash
# Average window width
jq -s 'map(.OverallWidth) | add / length' index/by_category/IFCWINDOW.jsonl
```

### Min/Max of a property
```bash
# Largest window width
jq -s 'map(.OverallWidth) | max' index/by_category/IFCWINDOW.jsonl

# Smallest window width
jq -s 'map(.OverallWidth) | min' index/by_category/IFCWINDOW.jsonl
```

## Discovery Queries

### List all categories
```bash
jq -r '.[] | .category' schema/categories.json
```

### List all categories with counts
```bash
jq -r '.[] | "\(.category): \(.count)"' schema/categories.json
```

### List all storeys
```bash
jq -r '.[] | .name' schema/storeys.json
```

### List all storeys with slugs
```bash
jq -r '.[] | "\(.name) → \(.slug)"' schema/storeys.json
```

### List all properties for a category
```bash
jq 'keys' schema/keys_by_category/IFCWINDOW.json
```

### List most common properties globally
```bash
jq -r 'to_entries | sort_by(-.value) | .[] | "\(.key): \(.value)"' schema/keys_global.json | head -20
```

## Grouping Queries

### Group by category
```bash
jq -s 'group_by(._category) | map({category: .[0]._category, count: length})' flat/elements.jsonl
```

### Group by storey
```bash
jq -s 'group_by(.storeySlug) | map({storey: .[0].storeySlug, count: length})' flat/elements.jsonl
```

### Group by object type
```bash
jq -s 'group_by(.ObjectType) | map({type: .[0].ObjectType, count: length})' index/by_category/IFCWINDOW.jsonl
```

## Complex Intersection Examples

### Windows on nivel_1
```bash
jq 'select(.storeySlug == "nivel_1")' index/by_category/IFCWINDOW.jsonl
```

### Doors on nivel_2
```bash
jq 'select(.storeySlug == "nivel_2")' index/by_category/IFCDOOR.jsonl
```

### Furniture on nivel_1
```bash
jq 'select(.storeySlug == "nivel_1")' index/by_category/IFCFURNISHINGELEMENT.jsonl
```

### Large windows on nivel_1
```bash
jq 'select(.storeySlug == "nivel_1" and .OverallWidth >= 1)' index/by_category/IFCWINDOW.jsonl
```

### Count by category on specific storey
```bash
# How many of each category on nivel_1?
jq -s 'group_by(._category) | map({category: .[0]._category, count: length})' index/by_storey/nivel_1.jsonl
```

## Practical Examples

### Q: How many doors are in the building?
```bash
wc -l < index/by_category/IFCDOOR.jsonl
```

### Q: What are the dimensions of all windows?
```bash
jq '{id: ._localId, name: .Name, width: .OverallWidth, height: .OverallHeight}' index/by_category/IFCWINDOW.jsonl
```

### Q: How many windows are on the first floor?
```bash
jq 'select(.storeySlug == "nivel_1")' index/by_category/IFCWINDOW.jsonl | wc -l
```

### Q: What categories exist in the model?
```bash
jq -r '.[] | .category' schema/categories.json
```

### Q: Get all furniture IDs on nivel_1
```bash
jq -r 'select(.storeySlug == "nivel_1") | ._localId' index/by_category/IFCFURNISHINGELEMENT.jsonl
```

### Q: Find all elements with specific object type
```bash
jq 'select(.ObjectType == "Ventana simple:100 x 100 cm")' flat/elements.jsonl
```

### Q: What's the average height of all windows?
```bash
jq -s 'map(.OverallHeight) | add / length' index/by_category/IFCWINDOW.jsonl
```

### Q: Which storey has the most elements?
```bash
for file in index/by_storey/*.jsonl; do
  echo "$(basename $file .jsonl): $(wc -l < $file)"
done | sort -t: -k2 -nr | head -1
```
