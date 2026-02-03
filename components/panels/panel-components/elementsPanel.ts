import * as BUI from '@thatopen/ui'
import * as CUI from '@thatopen/ui-obc'
import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import { appIcons } from '@/components/globals'

export interface ElementsDataPanelState {
  components: OBC.Components
  t: (key: string) => string
}

export const elementsDataPanelTemplate: BUI.StatefullComponent<
  ElementsDataPanelState
> = (state) => {
  const { components, t } = state

  // const fragments = components.get(OBC.FragmentsManager);
  const highlighter = components.get(OBF.Highlighter)

  const [propsTable, updatePropsTable] = CUI.tables.itemsData({
    components,
    modelIdMap: {},
  })

  propsTable.preserveStructureOnFilter = true
  // fragments.onFragmentsDisposed.add(() => updatePropsTable());

  highlighter.events.select.onHighlight.add((modelIdMap) => {
    // const panel = document.getElementById("data")!;
    // panel.style.removeProperty("display");
    updatePropsTable({ modelIdMap })
  })

  highlighter.events.select.onClear.add(() => {
    // const panel = document.getElementById("data")!;
    // panel.style.display = "none";
    updatePropsTable({ modelIdMap: {} })
  })

  const search = (e: Event) => {
    const input = e.target as BUI.TextInput
    propsTable.queryString = input.value
  }

  const toggleExpanded = () => {
    propsTable.expanded = !propsTable.expanded
  }

  const sectionId = BUI.Manager.newRandomId()

  return BUI.html`
    <bim-panel-section fixed id=${sectionId} icon=${appIcons.TASK} label=${t(
    'selection-data'
  )} style="max-height: 400px; display: flex; flex-direction: column;">
      <div style="display: flex; gap: 0.375rem; flex-shrink: 0;">
        <bim-text-input @input=${search} placeholder=${t(
    'search'
  )} debounce="200" style="flex: 1;"></bim-text-input>
        <bim-button style="flex: 0;" @click=${toggleExpanded} icon=${
    appIcons.EXPAND
  }></bim-button>
        <bim-button style="flex: 0;" @click=${() =>
          propsTable.downloadData('ElementData', 'tsv')} icon=${
    appIcons.EXPORT
  } tooltip-title=${t('export-data')} tooltip-text=${t(
    'export-tsv'
  )}></bim-button>
      </div>
      <div style="flex: 1; overflow-y: auto; min-height: 0;">
        ${propsTable}
      </div>
    </bim-panel-section> 
  `
}
