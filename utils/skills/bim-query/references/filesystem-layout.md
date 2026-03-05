# BIM Filesystem Layout

The BIM filesystem is a structured, query-optimized representation of IFC building data.

## Directory Structure

```
./bim_fs/
├─ source/                         # Original input JSON
│  └─ <input-file>.json
│
├─ flat/                           # All elements (JSONL format)
│  └─ elements.jsonl               # Full element data, one per line
│
├─ raw/                            # Individual element files
│  └─ by_id/
│     └─ <element_id>.json         # Full element data by ID
│
├─ index/                          # Pre-filtered indexes
│  ├─ by_category/
│  │  └─ <CATEGORY>.jsonl          # All elements of this category (full data)
│  └─ by_storey/
│     └─ <storey_slug>.jsonl       # All elements on this storey (full data)
│
├─ schema/                         # Metadata about the model
│  ├─ keys_global.json             # All property names with frequency counts
│  ├─ keys_by_category/
│  │  └─ <CATEGORY>.json           # Property names per category
│  ├─ categories.json              # List of all categories + element counts
│  └─ storeys.json                 # List of all storeys + slugs + aliases
│
└─ state/                          # Runtime state
   └─ last_result.json             # Cache for last query result
```

## File Formats

### JSONL (JSON Lines)
Each line is a complete, valid JSON object. Read line-by-line or use `jq`.

**Example: `index/by_category/IFCWINDOW.jsonl`**
```json
{"_localId":6518,"_category":"IFCWINDOW","Name":"Ventana simple:100 x 100 cm:164008","ObjectType":"Ventana simple:100 x 100 cm","OverallHeight":2.3,"OverallWidth":1,"ContainedInStructure":"Nivel 1","storeySlug":"nivel_1"}
{"_localId":6563,"_category":"IFCWINDOW","Name":"Ventana simple:100 x 100 cm:164121","ObjectType":"Ventana simple:100 x 100 cm","OverallHeight":2.3,"OverallWidth":1,"ContainedInStructure":"Nivel 1","storeySlug":"nivel_1"}
```

### JSON Schema Files

**`schema/categories.json`**
```json
[
  {"category": "IFCDOOR", "count": 1},
  {"category": "IFCWINDOW", "count": 9},
  {"category": "IFCFURNISHINGELEMENT", "count": 35}
]
```

**`schema/storeys.json`**
```json
[
  {
    "name": "Nivel 1",
    "slug": "nivel_1",
    "aliases": ["level_1", "1fl", "floor_1"],
    "type": "standard"
  }
]
```

**`schema/keys_global.json`**
```json
{
  "_localId": 100,
  "_category": 100,
  "Name": 100,
  "ObjectType": 95,
  "OverallWidth": 45,
  "OverallHeight": 45
}
```

## Query Optimization

### Index Files Include Full Data
All index files (`by_category/` and `by_storey/`) contain complete element data, not just references. This means:

- **Single-read queries**: No need to look up additional files
- **Fast filtering**: Use `jq` to filter properties directly
- **Efficient intersections**: Filter one index by another dimension

### When to Use Each Directory

1. **`schema/`** - Discovery (what categories/storeys exist, what properties are available)
2. **`index/by_category/`** - Category-specific queries (all doors, all windows)
3. **`index/by_storey/`** - Storey-specific queries (everything on nivel_1)
4. **`flat/elements.jsonl`** - Full model scan (rare, usually use indexes instead)
5. **`raw/by_id/`** - Direct ID lookup (when you already know the element ID)

### Intersection Queries

For queries combining **category AND storey** (e.g., "windows on nivel_1"):

**Option 1: Filter category index by storey**
```bash
jq 'select(.storeySlug == "nivel_1")' index/by_category/IFCWINDOW.jsonl
```

**Option 2: Filter storey index by category**
```bash
jq 'select(._category == "IFCWINDOW")' index/by_storey/nivel_1.jsonl
```

Choose based on which dimension is more selective (fewer elements).

## Performance Best Practices

1. **Check schema first** - Understand available data before querying
2. **Use indexes over flat** - Pre-filtered data is faster
3. **Prefer jq for filtering** - Fast and flexible JSON processing
4. **Count with wc -l** - Faster than reading/parsing data
5. **Avoid raw/by_id loops** - Use indexes instead of reading individual files
