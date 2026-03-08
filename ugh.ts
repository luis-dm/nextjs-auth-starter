// src/ifc-source-cache.ts
const ifcSourceCache = new Map<string, string>();

export const setIfcSource = (modelId: string, source: string) => {
  ifcSourceCache.set(modelId, source);
};

export const getIfcSource = (modelId: string) => ifcSourceCache.get(modelId);

// src/ui-templates/sections/models.ts
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
import * as OBC from '@thatopen/components';
import { appIcons } from '../../globals';
import { setIfcSource } from '../../ifc-source-cache';

export interface ModelsPanelState {
  components: OBC.Components;
}

export const modelsPanelTemplate: BUI.StatefullComponent<ModelsPanelState> = (
  state
) => {
  const { components } = state;

  const ifcLoader = components.get(OBC.IfcLoader);
  const fragments = components.get(OBC.FragmentsManager);

  const [modelsList] = CUI.tables.modelsList({
    components,
    actions: { download: false },
  });

  const onAddIfcModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = false;
    input.accept = '.ifc';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;

      const modelId = file.name.replace('.ifc', '');
      const source = await file.text();
      setIfcSource(modelId, source);

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await ifcLoader.load(bytes, true, modelId);

      target.loading = false;
      BUI.ContextMenu.removeMenus();
    });

    input.addEventListener('cancel', () => (target.loading = false));

    input.click();
  };

  const onAddFragmentsModel = async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = false;
    input.accept = '.frag';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await fragments.core.load(bytes, {
        modelId: file.name.replace('.frag', ''),
      });
      target.loading = false;
      BUI.ContextMenu.removeMenus();
    });

    input.addEventListener('cancel', () => (target.loading = false));

    input.click();
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };

  return BUI.html`
      <bim-panel-section fixed icon=${appIcons.MODEL} label="Models">
        <div style="display: flex; gap: 0.5rem;">
          <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-
  input>
          <bim-button style="flex: 0;" icon=${appIcons.ADD}>
            <bim-context-menu style="gap: 0.25rem;">
              <bim-button label="IFC" @click=${onAddIfcModel}></bim-button>
              <bim-button label="Fragments" @click=${onAddFragmentsModel}></bim-button>
            </bim-context-menu>
          </bim-button>
        </div>
        ${modelsList}
      </bim-panel-section>
    `;
};

// src/ui-templates/sections/elements-data.ts
import * as BUI from '@thatopen/ui';
import * as CUI from '@thatopen/ui-obc';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import { appIcons } from '../../globals';
import { getIfcSource } from '../../ifc-source-cache';

export interface ElementsDataPanelState {
  components: OBC.Components;
}

export const elementsDataPanelTemplate: BUI.StatefullComponent<
  ElementsDataPanelState
> = (state) => {
  const { components } = state;

  const fragments = components.get(OBC.FragmentsManager);
  const highlighter = components.get(OBF.Highlighter);

  const [propsTable] = CUI.tables.itemsData({
    components,
    modelIdMap: {},
  });

  propsTable.columns = [
    { name: 'Name', width: '12rem' },
    { name: 'Value', width: '10rem' },
  ];

  propsTable.dataTransform = {
    ...propsTable.dataTransform,
    Value: (value) => value ?? '',
  };

  propsTable.preserveStructureOnFilter = true;

  let currentModelIdMap: Record<string, Set<number>> = {};

  const splitIfcArgs = (source: string) => {
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

  const parseIfcList = (value: string) =>
    Array.from(value.matchAll(/#(\d+)/g), (match) => Number(match[1]));

  const decodeIfcString = (value: string) =>
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

  const getTypeProperties = (modelId: string, localId: number) => {
    const source = getIfcSource(modelId);
    if (!source) return [];

    const records = new Map<number, string>();
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      const match = line.match(/^#(\d+)=(.+);$/);
      if (match) records.set(Number(match[1]), match[2]);
    }

    const propertyValues = new Map<number, { name: string; value: string }>();
    const propertySets = new Map<
      number,
      { name: string; propertyIds: number[] }
    >();
    const typePropertySetIds = new Map<number, number[]>();
    const occurrenceTypeIds = new Map<number, number>();

    for (const [id, body] of records) {
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

      if (/^IFC[A-Z0-9_]*TYPE\(/.test(body)) {
        const inner = body.slice(body.indexOf('(') + 1, -1);
        const args = splitIfcArgs(inner);
        const propertySetsToken = args[5];
        if (!propertySetsToken || propertySetsToken === '$') continue;

        typePropertySetIds.set(id, parseIfcList(propertySetsToken));
      }
    }

    const typeId = occurrenceTypeIds.get(localId);
    if (!typeId) return [];

    const rows: Array<{ Name: string; Value: string }> = [];

    for (const psetId of typePropertySetIds.get(typeId) ?? []) {
      const pset = propertySets.get(psetId);
      if (!pset) continue;

      for (const propertyId of pset.propertyIds) {
        const property = propertyValues.get(propertyId);
        if (!property) continue;

        rows.push({
          Name: `${pset.name} / ${property.name}`,
          Value: property.value,
        });
      }
    }

    return rows;
  };

  propsTable.loadFunction = async () => {
    const rows: any[] = [];

    for (const [modelId, localIds] of Object.entries(currentModelIdMap)) {
      const model = fragments.list.get(modelId);
      if (!model) continue;

      for (const localId of localIds) {
        const [itemData] = await model.getItemsData([localId], {
          attributesDefault: true,
          relationsDefault: { attributes: false, relations: false },
          relations: {
            IsDefinedBy: { attributes: true, relations: true },
          },
        });

        if (itemData && Array.isArray((itemData as any).IsDefinedBy)) {
          for (const pset of (itemData as any).IsDefinedBy) {
            const psetName = pset.Name?.value ?? '';

            if (Array.isArray(pset.HasProperties)) {
              for (const prop of pset.HasProperties) {
                rows.push({
                  data: {
                    Name: `${psetName} / ${prop.Name?.value ?? ''}`,
                    Value: prop.NominalValue?.value ?? '',
                  },
                });
              }
            }
          }
        }

        const typeRows = getTypeProperties(modelId, localId);
        for (const row of typeRows) {
          rows.push({ data: row });
        }
      }
    }

    return rows;
  };

  highlighter.events.select.onHighlight.add((modelIdMap) => {
    currentModelIdMap = modelIdMap;
    void propsTable.loadData(true);
  });

  highlighter.events.select.onClear.add(() => {
    currentModelIdMap = {};
    void propsTable.loadData(true);
  });

  const search = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propsTable.queryString = input.value;
  };

  const toggleExpanded = () => {
    propsTable.expanded = !propsTable.expanded;
  };

  const sectionId = BUI.Manager.newRandomId();

  return BUI.html`
      <bim-panel-section fixed id=${sectionId} icon=${appIcons.TASK} label="Selection Data">
        <div style="display: flex; gap: 0.375rem;">
          <bim-text-input @input=${search} vertical placeholder="Search..." debounce="200"></bim-text-
  input>
          <bim-button style="flex: 0;" @click=${toggleExpanded} icon=${appIcons.EXPAND}></bim-button>
          <bim-button style="flex: 0;" @click=${() => propsTable.downloadData('ElementData', 'tsv')}
  icon=${appIcons.EXPORT} tooltip-title="Export Data" tooltip-text="Export the shown properties to TSV."></
  bim-button>
        </div>
        ${propsTable}
      </bim-panel-section>
    `;
};





/////////////////////////////////////////







to make lookups O(1):

Instead of caching only:

Map<modelId, source>

cache:

Map<modelId, TypePropertyIndex>



Create a parsed index type

export interface TypePropertyIndex {
  occurrenceToType: Map<number, number>;
  typeToPsets: Map<number, number[]>;
  psetToProperties: Map<number, number[]>;
  propertyValues: Map<number, { name: string; value: string }>;
  psetNames: Map<number, string>;
}



Cache the parsed result

const typeIndexCache = new Map<string, TypePropertyIndex>();

export const setTypeIndex = (modelId: string, index: TypePropertyIndex) => {
  typeIndexCache.set(modelId, index);
};

export const getTypeIndex = (modelId: string) => typeIndexCache.get(modelId);



Parse once at IFC load time

const index = buildTypePropertyIndex(source);
setTypeIndex(modelId, index);



Build the index (one-time cost)

Move ALL this:

records map
splitIfcArgs
IFCPROPERTYSET
IFCRELDEFINESBYTYPE
IFC...TYPE

into:

function buildTypePropertyIndex(source: string): TypePropertyIndex

It runs onec/model



O(1) lookup during selection

getTypeProperties becomes:

const getTypeProperties = (modelId: string, localId: number) => {
  const index = getTypeIndex(modelId);
  if (!index) return [];

  const typeId = index.occurrenceToType.get(localId);
  if (!typeId) return [];

  const rows = [];

  for (const psetId of index.typeToPsets.get(typeId) ?? []) {
    const psetName = index.psetNames.get(psetId);
    const propIds = index.psetToProperties.get(psetId) ?? [];

    for (const propId of propIds) {
      const prop = index.propertyValues.get(propId);
      if (!prop) continue;

      rows.push({
        Name: `${psetName} / ${prop.name}`,
        Value: prop.value,
      });
    }
  }

  return rows;
};