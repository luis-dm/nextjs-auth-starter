/**
 * IFC Type Property Index for O(1) property lookups
 * Based on documentation in rich-properties.md
 */

export interface TypePropertyIndex {
  occurrenceToType: Record<number, number>;
  typeToPsets: Record<number, number[]>;
  psetToProperties: Record<number, number[]>;
  propertyValues: Record<number, { name: string; value: string }>;
  psetNames: Record<number, string>;
  // Material-related indices (optional for backward compatibility with old caches)
  materials?: Record<number, string>; // materialId → name
  materialLayers?: Record<number, { materialId: number; thickness?: number }>; // layerId → material + thickness
  materialLayerSets?: Record<number, number[]>; // layerSetId → layerIds[]
  materialLayerSetUsages?: Record<number, number>; // usageId → layerSetId (intermediate objects)
  occurrenceToMaterial?: Record<number, number>; // elementId → materialId or layerSetId or usageId
}

/**
 * Split IFC argument string into tokens, respecting nested structures and strings
 */
const splitIfcArgs = (source: string): string[] => {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let inString = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "'") {
      current += ch;
      if (inString && next === "'") {
        current += next;
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === "," && depth === 0) {
        args.push(current.trim());
        current = "";
        continue;
      }
    }

    current += ch;
  }

  if (current) args.push(current.trim());
  return args;
};

/**
 * Parse IFC list notation (#123,#456,#789) into array of numbers
 */
const parseIfcList = (value: string): number[] =>
  Array.from(value.matchAll(/#(\d+)/g), (match) => Number(match[1]));

/**
 * Decode IFC string with escaped characters and unicode
 */
const decodeIfcString = (value: string): string =>
  value
    .replace(/''/g, "'")
    .replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (_, hex: string) => {
      let decoded = "";
      for (let i = 0; i < hex.length; i += 4) {
        const cp = Number.parseInt(hex.slice(i, i + 4), 16);
        if (!Number.isNaN(cp)) decoded += String.fromCharCode(cp);
      }
      return decoded;
    });

/**
 * Build a complete type property index from IFC source text
 * This is a one-time operation per model that enables O(1) property lookups
 */
export const buildTypePropertyIndex = (source: string): TypePropertyIndex => {
  const records = new Map<number, string>();

  // Parse all IFC records into a map
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^#(\d+)=(.+);$/);
    if (match) {
      records.set(Number(match[1]), match[2]);
    }
  }

  const propertyValues = new Map<number, { name: string; value: string }>();
  const propertySets = new Map<
    number,
    { name: string; propertyIds: number[] }
  >();
  const typePropertySetIds = new Map<number, number[]>();
  const occurrenceTypeIds = new Map<number, number>();

  // Material-related maps
  const materials = new Map<number, string>();
  const materialLayers = new Map<
    number,
    { materialId: number; thickness?: number }
  >();
  const materialLayerSets = new Map<number, number[]>();
  const materialLayerSetUsages = new Map<number, number>(); // Usage ID → LayerSet ID
  const occurrenceToMaterial = new Map<number, number>();

  // Parse each record type
  for (const [id, body] of records) {
    // Parse IFCPROPERTYSINGLEVALUE
    if (body.startsWith("IFCPROPERTYSINGLEVALUE(")) {
      const inner = body.slice("IFCPROPERTYSINGLEVALUE(".length, -1);
      const args = splitIfcArgs(inner);
      const nameMatch = args[0]?.match(/^'(.*)'$/);
      const valueMatch = args[2]?.match(/^[A-Z0-9_]+\('(.*)'\)$/);
      if (!nameMatch || !valueMatch) continue;

      propertyValues.set(id, {
        name: decodeIfcString(nameMatch[1]),
        value: decodeIfcString(valueMatch[1]),
      });
      continue;
    }

    // Parse IFCPROPERTYSET
    if (body.startsWith("IFCPROPERTYSET(")) {
      const inner = body.slice("IFCPROPERTYSET(".length, -1);
      const args = splitIfcArgs(inner);
      const nameMatch = args[2]?.match(/^'(.*)'$/);
      if (!nameMatch || !args[4]) continue;

      propertySets.set(id, {
        name: decodeIfcString(nameMatch[1]),
        propertyIds: parseIfcList(args[4]),
      });
      continue;
    }

    // Parse IFCRELDEFINESBYTYPE (links occurrences to types)
    if (body.startsWith("IFCRELDEFINESBYTYPE(")) {
      const inner = body.slice("IFCRELDEFINESBYTYPE(".length, -1);
      const args = splitIfcArgs(inner);
      const relatedObjectsToken = args[4];
      const relatingTypeToken = args[5];
      const typeMatch = relatingTypeToken?.match(/^#(\d+)$/);
      if (!relatedObjectsToken || !typeMatch) continue;

      const typeId = Number(typeMatch[1]);
      for (const occurrenceId of parseIfcList(relatedObjectsToken)) {
        occurrenceTypeIds.set(occurrenceId, typeId);
      }
      continue;
    }

    // Parse IFC*TYPE entities (walls, doors, etc.)
    if (/^IFC[A-Z0-9_]*TYPE\(/.test(body)) {
      const inner = body.slice(body.indexOf("(") + 1, -1);
      const args = splitIfcArgs(inner);
      const propertySetsToken = args[5];
      if (!propertySetsToken || propertySetsToken === "$") continue;

      typePropertySetIds.set(id, parseIfcList(propertySetsToken));
      continue;
    }

    // Parse IFCMATERIAL
    if (body.startsWith("IFCMATERIAL(")) {
      const inner = body.slice("IFCMATERIAL(".length, -1);
      const args = splitIfcArgs(inner);
      const nameMatch = args[0]?.match(/^'(.*)'$/);
      if (nameMatch) {
        materials.set(id, decodeIfcString(nameMatch[1]));
      }
      continue;
    }

    // Parse IFCMATERIALLAYER
    if (body.startsWith("IFCMATERIALLAYER(")) {
      const inner = body.slice("IFCMATERIALLAYER(".length, -1);
      const args = splitIfcArgs(inner);
      const materialMatch = args[0]?.match(/^#(\d+)$/);
      const thicknessMatch = args[1]?.match(/^[\d.]+$/);
      if (materialMatch) {
        materialLayers.set(id, {
          materialId: Number(materialMatch[1]),
          thickness: thicknessMatch ? Number(args[1]) : undefined,
        });
      }
      continue;
    }

    // Parse IFCMATERIALLAYERSET
    if (body.startsWith("IFCMATERIALLAYERSET(")) {
      const inner = body.slice("IFCMATERIALLAYERSET(".length, -1);
      const args = splitIfcArgs(inner);
      if (args[0] && args[0] !== "$") {
        materialLayerSets.set(id, parseIfcList(args[0]));
      }
      continue;
    }

    // Parse IFCMATERIALLAYERSETUSAGE (intermediate object pointing to layer set)
    if (body.startsWith("IFCMATERIALLAYERSETUSAGE(")) {
      const inner = body.slice("IFCMATERIALLAYERSETUSAGE(".length, -1);
      const args = splitIfcArgs(inner);
      const layerSetMatch = args[0]?.match(/^#(\d+)$/);
      if (layerSetMatch) {
        const layerSetId = Number(layerSetMatch[1]);
        materialLayerSetUsages.set(id, layerSetId);
      }
      continue;
    }

    // Parse IFCRELASSOCIATESMATERIAL (links elements to materials)
    if (body.startsWith("IFCRELASSOCIATESMATERIAL(")) {
      const inner = body.slice("IFCRELASSOCIATESMATERIAL(".length, -1);
      const args = splitIfcArgs(inner);
      const relatedObjectsToken = args[4];
      const relatingMaterialToken = args[5];
      const materialMatch = relatingMaterialToken?.match(/^#(\d+)$/);

      if (relatedObjectsToken && materialMatch) {
        const materialId = Number(materialMatch[1]);
        for (const occurrenceId of parseIfcList(relatedObjectsToken)) {
          occurrenceToMaterial.set(occurrenceId, materialId);
        }
      }
      continue;
    }
  }

  // Log extraction statistics
  console.log("📊 IFC Type Index Build Complete:", {
    propertyValues: propertyValues.size,
    propertySets: propertySets.size,
    typePropertySetIds: typePropertySetIds.size,
    occurrenceTypeIds: occurrenceTypeIds.size,
    materials: materials.size,
    materialLayers: materialLayers.size,
    materialLayerSets: materialLayerSets.size,
    materialLayerSetUsages: materialLayerSetUsages.size,
    occurrenceToMaterial: occurrenceToMaterial.size,
  });

  // Log sample materials if any were found
  if (materials.size > 0) {
    const sampleMaterials = Array.from(materials.entries()).slice(0, 5);
    console.log(
      "🎨 Sample Materials:",
      sampleMaterials.map(([id, name]) => ({ id, name })),
    );
  }

  // Log sample material layer set usages
  if (materialLayerSetUsages.size > 0) {
    const sampleUsages = Array.from(materialLayerSetUsages.entries()).slice(0, 5);
    console.log(
      "🔗 Sample Material Layer Set Usages (UsageID → LayerSetID):",
      sampleUsages.map(([usageId, layerSetId]) => ({ usageId, layerSetId })),
    );
  }

  // Convert Maps to plain objects for JSON serialization
  const index: TypePropertyIndex = {
    occurrenceToType: Object.fromEntries(occurrenceTypeIds),
    typeToPsets: Object.fromEntries(typePropertySetIds),
    psetToProperties: Object.fromEntries(
      Array.from(propertySets.entries()).map(([id, { propertyIds }]) => [
        id,
        propertyIds,
      ]),
    ),
    propertyValues: Object.fromEntries(propertyValues),
    psetNames: Object.fromEntries(
      Array.from(propertySets.entries()).map(([id, { name }]) => [id, name]),
    ),
    materials: Object.fromEntries(materials),
    materialLayers: Object.fromEntries(materialLayers),
    materialLayerSets: Object.fromEntries(materialLayerSets),
    materialLayerSetUsages: Object.fromEntries(materialLayerSetUsages),
    occurrenceToMaterial: Object.fromEntries(occurrenceToMaterial),
  };

  return index;
};

/**
 * Get type properties for a specific element using the cached index
 * O(1) lookup - no parsing required
 */
export const getTypeProperties = (
  index: TypePropertyIndex,
  localId: number,
): Array<{ Name: string; Value: string }> => {
  const rows: Array<{ Name: string; Value: string }> = [];

  // Add type properties
  const typeId = index.occurrenceToType[localId];
  if (typeId) {
    for (const psetId of index.typeToPsets[typeId] ?? []) {
      const psetName = index.psetNames[psetId];
      const propIds = index.psetToProperties[psetId] ?? [];

      for (const propId of propIds) {
        const prop = index.propertyValues[propId];
        if (!prop) continue;

        rows.push({
          Name: `${psetName} / ${prop.name}`,
          Value: prop.value,
        });
      }
    }
  }

  // Add material properties (check if material fields exist for backward compatibility)
  if (index.occurrenceToMaterial && index.materials) {
    let materialId = index.occurrenceToMaterial[localId];
    if (materialId) {
      console.log(`🔍 Element ${localId} has material ID: ${materialId}`);
      console.log(`🔍 Index has materialLayerSetUsages?`, {
        hasMaterialLayerSetUsages: !!index.materialLayerSetUsages,
        materialLayerSetUsagesCount: index.materialLayerSetUsages
          ? Object.keys(index.materialLayerSetUsages).length
          : 0,
        isInUsages: index.materialLayerSetUsages
          ? materialId in index.materialLayerSetUsages
          : false,
      });

      // Resolve intermediate objects (IFCMATERIALLAYERSETUSAGE → IFCMATERIALLAYERSET)
      if (
        index.materialLayerSetUsages &&
        materialId in index.materialLayerSetUsages
      ) {
        const resolvedId = index.materialLayerSetUsages[materialId];
        console.log(
          `🔄 Resolved usage ID ${materialId} to layer set ID ${resolvedId}`,
        );
        materialId = resolvedId;
      }

      console.log(`📦 Checking materials map:`, {
        hasMaterialsMap: !!index.materials,
        materialIdsInMap: Object.keys(index.materials).length,
        hasThisMaterial: materialId in index.materials,
        materialValue: index.materials[materialId],
      });

      // Check if it's a direct material reference
      const material = index.materials[materialId];
      if (material) {
        console.log(`🎨 Found direct material: "${material}"`);
        rows.push({
          Name: "Material",
          Value: material,
        });
      } else {
        console.log(`⚠️ Material ID ${materialId} not found in materials map`);
      }

      // Check if it's a material layer set
      if (index.materialLayerSets && index.materialLayers) {
        const layerIds = index.materialLayerSets[materialId];
        console.log(`📦 Checking layer sets:`, {
          hasLayerSetsMap: !!index.materialLayerSets,
          layerSetIdsInMap: Object.keys(index.materialLayerSets).length,
          hasThisLayerSet: materialId in index.materialLayerSets,
          layerIds: layerIds,
        });

        if (layerIds && layerIds.length > 0) {
          console.log(
            `📚 Found ${layerIds.length} material layers for ID ${materialId}`,
          );
          for (let i = 0; i < layerIds.length; i++) {
            const layerId = layerIds[i];
            const layer = index.materialLayers[layerId];
            if (layer) {
              const materialName =
                index.materials[layer.materialId] || "Unknown";
              const layerLabel =
                layerIds.length > 1 ? `Material Layer ${i + 1}` : "Material";
              rows.push({
                Name: layerLabel,
                Value: layer.thickness
                  ? `${materialName} (${layer.thickness}mm)`
                  : materialName,
              });
            }
          }
        }
      }
    } else {
      console.log(`ℹ️ Element ${localId} has no material association in index`);
    }
  } else {
    console.log(`⚠️ Index does not contain material data (old cache format)`);
  }

  return rows;
};
