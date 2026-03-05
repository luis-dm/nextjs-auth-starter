---
name: bim-query
description: Query BIM elements efficiently including semantic search by name/type
version: 1.1.0
tags:
  - bim
  - ifc
  - query
  - building
  - semantic-search
---

# BIM Query Skill

You are a BIM query assistant. Query building elements efficiently from the structured filesystem at `./bim_fs/`.

## Filesystem Structure

```
./bim_fs/
├─ source/              # Original JSON
├─ flat/                # All elements (JSONL)
├─ raw/by_id/           # Full elements by ID
├─ index/
│  ├─ by_category/      # Full elements per category (JSONL)
│  └─ by_storey/        # Full elements per storey (JSONL)
├─ schema/
│  ├─ categories.json   # List of categories + counts
│  ├─ storeys.json      # List of storeys + aliases
│  ├─ object_types.json # All object types with categories (NEW!)
│  ├─ keys_global.json  # All property names + frequency
│  └─ keys_by_category/ # Properties per category
└─ state/
```

## Query Strategy (CRITICAL - Follow This Order)

### 1. Discovery Queries

**Start here** to understand what's available:

```bash
# List all categories
bash skills/bim-query/scripts/list_categories.sh

# List all storeys
bash skills/bim-query/scripts/list_storeys.sh

# List all object types (optionally filtered by category)
bash skills/bim-query/scripts/list_object_types.sh
bash skills/bim-query/scripts/list_object_types.sh IFCFURNISHINGELEMENT

# Check what properties exist for a category
bash skills/bim-query/scripts/check_properties.sh IFCDOOR
```

### 2. Semantic/Name-Based Search (NEW!)

**Search by partial name match** for furniture, equipment, specific types:

```bash
# Search for object types containing "breuer"
bash skills/bim-query/scripts/search_by_name.sh "breuer"
# Output: IFCFURNISHINGELEMENT|M_Chair-Breuer:M_Chair-Breuer|28

# Search for valves
bash skills/bim-query/scripts/search_by_name.sh "valve"

# Get IDs for a specific object type
bash skills/bim-query/scripts/get_ids_by_object_type.sh "M_Chair-Breuer:M_Chair-Breuer"
```

**Semantic search workflow:**
1. Search by keyword → get matching object types
2. Extract object type names from search results
3. Get IDs for each object type
4. Combine results

**Example - "How many chairs?"**
```bash
# Search for chair types
bash skills/bim-query/scripts/search_by_name.sh "chair"
# Returns multiple chair types with counts
# Sum the counts from output
```

### 3. Counting Queries

**Fast counts** without reading full data:

```bash
# Count elements in a category
bash skills/bim-query/scripts/count_category.sh IFCDOOR

# Count elements on a storey
bash skills/bim-query/scripts/count_storey.sh nivel_1

# Alternative: Direct wc -l (if you need to customize)
wc -l < index/by_category/IFCDOOR.jsonl
```

### 4. Filtered Queries

**Use jq or grep** on index files (each line is a complete JSON object):

```bash
# Get all IDs in a category
jq -r '._localId' index/by_category/IFCDOOR.jsonl

# Get specific property from all elements in category
jq -r '{id: ._localId, width: .OverallWidth}' index/by_category/IFCWINDOW.jsonl

# Filter by property value
jq 'select(.OverallWidth > 1)' index/by_category/IFCWINDOW.jsonl
```

### 5. Intersection Queries

**Combine category AND storey** using scripts or jq:

```bash
# Using intersection script (recommended)
bash skills/bim-query/scripts/intersection.sh IFCWINDOW nivel_1

# Or use jq for filtering:
jq 'select(.storeySlug == "nivel_1")' index/by_category/IFCWINDOW.jsonl

# Get IDs only
jq -r 'select(.storeySlug == "nivel_1") | ._localId' index/by_category/IFCWINDOW.jsonl
```

### 6. Individual Element Lookup

**Only when you need a specific element** by ID:

```bash
# Get full element by ID
cat raw/by_id/22492.json | jq
```

## Common Query Patterns

### Search by name (semantic search)

```bash
# Find all Breuer furniture
bash skills/bim-query/scripts/search_by_name.sh "breuer"

# Get IDs for specific object type
bash skills/bim-query/scripts/get_ids_by_object_type.sh "M_Chair-Breuer:M_Chair-Breuer"
```

### Count elements in a category

```bash
bash skills/bim-query/scripts/count_category.sh IFCDOOR
```

### List object types in a category

```bash
bash skills/bim-query/scripts/list_object_types.sh IFCFURNISHINGELEMENT
```

### Get all IDs in a category

```bash
bash skills/bim-query/scripts/get_ids_by_category.sh IFCDOOR
```

### Get specific property from all elements

```bash
# Get widths of all windows
jq -r '{id: ._localId, name: .Name, width: .OverallWidth}' index/by_category/IFCWINDOW.jsonl
```

### Filter by property value

```bash
# Windows wider than 1 meter
jq 'select(.OverallWidth > 1)' index/by_category/IFCWINDOW.jsonl
```

### Intersection: category + storey

## Available Scripts

Use these pre-built scripts in `skills/bim-query/scripts/`:

**Discovery:**
- `list_categories.sh` - List all IFC categories with counts
- `list_storeys.sh` - List all building levels
- `list_object_types.sh [CATEGORY]` - List all object types (optionally filtered)
- `check_properties.sh <CATEGORY>` - Check available properties for a category
## Element Data Format

Each element in index files contains:

- `_localId` - Unique element ID
- `_category` - IFC category (IFCDOOR, IFCWINDOW, etc.)
- `Name` - Element name (includes unique ID)
- `ObjectType` - Element type/family (without unique ID suffix)
- `ContainedInStructure` - Storey name
- `storeySlug` - Slugified storey name (for filtering)
- All other properties specific to the element (Width, Height, Area, etc.)

## Examples

**Q: How many doors are there?**

```bash
bash skills/bim-query/scripts/count_category.sh IFCDOOR
```

**Q: Find all Breuer chairs**

```bash
# Search for Breuer types
bash skills/bim-query/scripts/search_by_name.sh "breuer"
# Output: IFCFURNISHINGELEMENT|M_Chair-Breuer:M_Chair-Breuer|28

# Get their IDs
bash skills/bim-query/scripts/get_ids_by_object_type.sh "M_Chair-Breuer:M_Chair-Breuer"
```

**Q: How many types of windows exist?**

```bash
bash skills/bim-query/scripts/list_object_types.sh IFCWINDOW
```

**Q: What are the dimensions of all windows?**

```bash
jq '{id: ._localId, name: .Name, width: .OverallWidth, height: .OverallHeight}' index/by_category/IFCWINDOW.jsonl
```

**Q: How many windows are on nivel_1?**

```bash
bash skills/bim-query/scripts/intersection.sh IFCWINDOW nivel_1 | wc -l
```

**Q: What categories exist?**

```bash
bash skills/bim-query/scripts/list_categories.sh
```

**Q: Get all furniture IDs on nivel_1**

```bash
bash skills/bim-query/scripts/intersection.sh IFCFURNISHINGELEMENT nivel_1
```

**Q: Count all chairs (semantic search)**

```bash
# Search for all chair types
bash skills/bim-query/scripts/search_by_name.sh "chair"
# Sum the counts from the third column of output
```Available Scripts

Use these pre-built scripts in `skills/bim-query/scripts/`:

- `get_ids_by_category.sh <CATEGORY>` - Get all IDs in a category
- `get_ids_by_storey.sh <STOREY_SLUG>` - Get all IDs on a storey
- `get_property.sh <CATEGORY> <PROPERTY>` - Get a property from all elements in category
- `intersection.sh <CATEGORY> <STOREY_SLUG>` - Get elements matching both category and storey

## Element Data Format

Each element in index files contains:

- `_localId` - Unique element ID
- `_category` - IFC category (IFCDOOR, IFCWINDOW, etc.)
- `Name` - Element name
- `ObjectType` - Element type/family
- `ContainedInStructure` - Storey name
- `storeySlug` - Slugified storey name (for filtering)
- All other properties specific to the element (Width, Height, Area, etc.)

## Examples

**Q: How many doors are there?**

```bash
wc -l < index/by_category/IFCDOOR.jsonl
```

**Q: What are the dimensions of all windows?**

```bash
jq '{id: ._localId, name: .Name, width: .OverallWidth, height: .OverallHeight}' index/by_category/IFCWINDOW.jsonl
```

**Q: How many windows are on nivel_1?**

```bash
jq 'select(.storeySlug == "nivel_1")' index/by_category/IFCWINDOW.jsonl | wc -l
```

**Q: What categories exist?**

```bash
jq -r '.[] | .category' schema/categories.json
```

**Q: Get all furniture IDs on nivel_1**

```bash
jq -r 'select(.storeySlug == "nivel_1") | ._localId' index/by_category/IFCFURNISHINGELEMENT.jsonl
```
