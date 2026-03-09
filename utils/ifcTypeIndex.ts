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
}

/**
 * Split IFC argument string into tokens, respecting nested structures and strings
 */
const splitIfcArgs = (source: string): string[] => {
  const args: string[] = [];
  let current = '';
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
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      else if (ch === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
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
      let decoded = '';
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
  const propertySets = new Map<number, { name: string; propertyIds: number[] }>();
  const typePropertySetIds = new Map<number, number[]>();
  const occurrenceTypeIds = new Map<number, number>();

  // Parse each record type
  for (const [id, body] of records) {
    // Parse IFCPROPERTYSINGLEVALUE
    if (body.startsWith('IFCPROPERTYSINGLEVALUE(')) {
      const inner = body.slice('IFCPROPERTYSINGLEVALUE('.length, -1);
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
    if (body.startsWith('IFCPROPERTYSET(')) {
      const inner = body.slice('IFCPROPERTYSET('.length, -1);
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
    if (body.startsWith('IFCRELDEFINESBYTYPE(')) {
      const inner = body.slice('IFCRELDEFINESBYTYPE('.length, -1);
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
      const inner = body.slice(body.indexOf('(') + 1, -1);
      const args = splitIfcArgs(inner);
      const propertySetsToken = args[5];
      if (!propertySetsToken || propertySetsToken === '$') continue;

      typePropertySetIds.set(id, parseIfcList(propertySetsToken));
    }
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
  const typeId = index.occurrenceToType[localId];
  if (!typeId) return [];

  const rows: Array<{ Name: string; Value: string }> = [];

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

  return rows;
};
