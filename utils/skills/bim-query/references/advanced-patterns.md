# Advanced Query Patterns

## IFC Standard Properties

**Property Sets (Pset)** - Optional semantic properties:

- **Pset_DoorCommon**: FireRating, AcousticRating, SecurityRating, IsExternal, ThermalTransmittance, GlazingAreaFraction, FireExit, SelfClosing, SmokeStop
- **Pset_WindowCommon**: FireRating, AcousticRating, SecurityRating, IsExternal, ThermalTransmittance, GlazingAreaFraction, HasDrive, SmokeStop
- **Pset_WallCommon**: FireRating, AcousticRating, ThermalTransmittance, IsExternal, LoadBearing, Combustible

**Base Quantities (Qto)** - Geometric measurements:

- **Length**: Height, Width, Depth, Perimeter, Length
- **Area**: GrossArea, NetArea, GrossSideArea, NetSideArea, GrossFootprintArea, NetFootprintArea
- **Volume**: GrossVolume, NetVolume
- **Count**: Count (for quantities)
- **Weight**: GrossWeight, NetWeight
- **Time**: (for scheduling)

**Common Base Properties** (always available):

- \_localId, \_category, name, Name
- ObjectType, ContainedInStructure, storeySlug
- OverallHeight, OverallWidth (doors/windows)

**Property Naming Conventions**:

- Properties may vary by export software (Revit, ArchiCAD, etc.)
- Check actual properties with: `cat raw/by_id/{id}.json | grep -oE '"[^"]+":[^,}]+' | head -20`
- Common variations: Height/OverallHeight/NominalHeight, Width/OverallWidth/NominalWidth

## Aggregation

**Sum dimensions:**

```bash
cat index/by_category/IFCWINDOW.jsonl | grep -oE '"OverallWidth":[0-9.]+' | cut -d: -f2 | awk '{s+=$1} END {print s}'
```

**Average:**

```bash
cat index/by_category/IFCDOOR.jsonl | grep -oE '"OverallHeight":[0-9.]+' | cut -d: -f2 | awk '{s+=$1; n++} END {print s/n}'
```

**Min/Max:**

```bash
# Max
cat index/by_category/IFCWINDOW.jsonl | grep -oE '"OverallWidth":[0-9.]+' | cut -d: -f2 | sort -n | tail -1

# Min
cat index/by_category/IFCWINDOW.jsonl | grep -oE '"OverallWidth":[0-9.]+' | cut -d: -f2 | sort -n | head -1
```

## Grouping

**Count by category per floor:**

```bash
cat index/by_storey/nivel_1.jsonl | grep -oE '"_category":"[^"]+' | cut -d'"' -f4 | sort | uniq -c
```

**Count by ObjectType:**

```bash
cat index/by_category/IFCDOOR.jsonl | grep -oE '"ObjectType":"[^"]+' | cut -d'"' -f4 | sort | uniq -c
```

## Property Calculations

**Calculate areas (when not provided):**

- Most elements only have: OverallHeight, OverallWidth
- Area = OverallHeight × OverallWidth
- Always state "(calculated)" when inferring

**Property fallbacks:**

- Height: OverallHeight → NominalHeight → (not available)
- Width: OverallWidth → NominalWidth → (not available)

## Semantic Queries

**Find elements by name pattern:**

```bash
grep '"Name":".*chair.*"' index/by_category/IFCFURNISHINGELEMENT.jsonl
```

**Filter by property value:**

```bash
# Doors taller than 2m
cat index/by_category/IFCDOOR.jsonl | grep -oE '"OverallHeight":[0-9.]+.*"_localId":[0-9]+' | awk -F: '$2 > 2'
```

## Performance Tips

1. **Count only:** Use `wc -l` instead of reading files
2. **ID extraction:** Use grep patterns from scripts/
3. **Avoid jq:** grep/awk are 10-100x faster
4. **Filter early:** Use grep before processing with awk
