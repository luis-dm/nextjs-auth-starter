import * as BUI from '@thatopen/ui'
import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import { appIcons } from '@/components/globals'

export interface ViewsPanelState {
  components: OBC.Components
  t: (key: string) => string
}

type ViewsListTableData = {
  Name: string
  Actions: string
}

export const viewsPanelTemplate: BUI.StatefullComponent<ViewsPanelState> = (
  state
) => {
  const { components, t } = state

  // Views Setup - Initialize early for better compatibility
  const views = components.get(OBC.Views)
  const casters = components.get(OBC.Raycasters)

  // Set default range for views similar to tutorial
  OBC.Views.defaultRange = 100

  // Get or set the world for views
  let world = views.world
  if (!world) {
    // Try to get the world from the components
    const worlds = components.get(OBC.Worlds)
    const worldsList = [...worlds.list.values()]
    if (worldsList.length > 0) {
      world = worldsList[0]
      views.world = world
    }
  }

  // Set up double-click functionality for creating sections
  if (world) {
    const caster = casters.get(world)

    const onDoubleClick = async () => {
      // Check if any measurement tools are active to avoid conflicts
      const lengthMeasurer = components.get(OBF.LengthMeasurement)
      const areaMeasurer = components.get(OBF.AreaMeasurement)
      const clipper = components.get(OBC.Clipper)

      // Don't create sections if other tools are active
      if (lengthMeasurer.enabled || areaMeasurer.enabled || clipper.enabled) {
        console.log('Other tools are active, skipping section creation')
        return
      }

      console.log('Double-click detected, creating section view...')
      const result = await caster.castRay()
      if (!result) {
        console.log('No raycast result')
        return
      }
      const { normal, point } = result
      if (!(normal && point)) {
        console.log('No normal or point from raycast')
        return
      }

      // Invert the normal direction so the view looks inside
      const invertedNormal = normal.clone().negate()
      const viewId = `Section - ${views.list.size + 1}`

      console.log('Creating view with ID:', viewId)
      const view = views.create(
        invertedNormal,
        point.addScaledVector(normal, 1),
        {
          id: viewId,
          world: world || undefined,
        }
      )

      // Set a reasonable range for sections
      view.range = 20
      // Display helpers for debugging (can be turned off later)
      view.helpersVisible = false

      console.log('Section view created:', viewId)
      updateTableData()
      updateViewsTable({ components })
    }

    // Add the double-click listener when the component is created
    // We need to ensure we don't add multiple listeners
    if (!world.renderer?.three.domElement.hasAttribute('data-views-listener')) {
      world.renderer?.three.domElement.addEventListener(
        'dblclick',
        onDoubleClick
      )
      world.renderer?.three.domElement.setAttribute(
        'data-views-listener',
        'true'
      )
    }
  }

  let tableElement: BUI.Table<ViewsListTableData> | null = null

  const onCreated = (e?: Element) => {
    if (!e) return
    tableElement = e as BUI.Table<ViewsListTableData>
    updateTableData()
  }

  const updateTableData = () => {
    if (!tableElement) return
    tableElement.data = [...views.list.keys()].map((key) => {
      return {
        data: {
          Name: key,
          Actions: '',
        },
      }
    })
  }

  const [viewsTable, updateViewsTable] = BUI.Component.create<
    BUI.Table<ViewsListTableData>,
    ViewsPanelState
  >(
    () => {
      return BUI.html`<bim-table ${BUI.ref(onCreated)}></bim-table>`
    },
    { components, t }
  )

  viewsTable.headersHidden = true
  viewsTable.noIndentation = true
  viewsTable.columns = ['Name', { name: 'Actions', width: 'auto' }]

  viewsTable.dataTransform = {
    Actions: (_, rowData) => {
      const { Name } = rowData
      if (!Name) return _
      const view = views.list.get(Name)
      if (!view) return _

      const onOpen = async () => {
        console.log('Opening view:', Name)
        try {
          const view = views.list.get(Name)
          if (!view) {
            console.error('View not found:', Name)
            return
          }

          console.log('View details:', {
            id: view.id,
            hasWorld: !!view.world,
            camera: view.world?.camera?.constructor.name,
          })

          // Simplified approach - just open the view
          // The Views component should handle camera switching automatically
          views.open(Name)

          // Re-enable user input after opening the view
          // This allows the user to navigate around in the 2D view
          setTimeout(() => {
            if (
              world?.camera &&
              world.camera instanceof OBC.OrthoPerspectiveCamera
            ) {
              world.camera.setUserInput(true)
            }
          }, 100) // Small delay to ensure view is fully opened

          console.log('View opened successfully')
        } catch (error) {
          console.error('Error opening view:', error)
        }
      }

      const onRemove = () => {
        views.list.delete(Name)
        updateTableData()
        updateViewsTable({ components })
      }

      return BUI.html`
        <bim-button label-hidden icon="solar:cursor-bold" label="Open" @click=${onOpen}></bim-button>
        <bim-button label-hidden icon="material-symbols:delete" label="Remove" @click=${onRemove}></bim-button>
      `
    },
  }

  const updateFunction = () => {
    updateTableData()
    updateViewsTable({ components })
  }
  views.list.onItemSet.add(updateFunction)
  views.list.onItemDeleted.add(updateFunction)
  views.list.onItemUpdated.add(updateFunction)
  views.list.onCleared.add(updateFunction)

  const onInitializeViews = async () => {
    try {
      console.log('Initializing views...')

      // Check if world is available
      if (!views.world) {
        console.error('No world available for views')
        return
      }

      // Get the fragments manager to check for loaded models
      const fragments = components.get(OBC.FragmentsManager)
      const modelIds = [...fragments.list.keys()]

      console.log('Available models:', modelIds)

      if (modelIds.length === 0) {
        console.warn('No models loaded. Please load a model first.')
        return
      }

      // Create views from IFC storeys (try architectural model first, then all models)
      console.log('Creating views from IFC storeys...')
      let storyViews = await views.createFromIfcStoreys({ modelIds: [/arq/] })

      // If no views were created with architectural model pattern, try with all models
      if (!storyViews || storyViews.length === 0) {
        console.log('No architectural model found, trying with all models...')
        // Try without specifying modelIds to include all models
        storyViews = await views.createFromIfcStoreys()
      }

      // Configure the created story views
      if (storyViews && storyViews.length > 0) {
        storyViews.forEach((view) => {
          view.range = 100 // Use larger range similar to tutorial
          view.helpersVisible = false // Hide helpers for cleaner views
        })
      }

      console.log('Created story views:', storyViews?.length || 0)

      // Create elevation views
      console.log('Creating elevation views...')
      const elevationViews = views.createElevations({ combine: true })

      // Configure the created elevation views
      if (elevationViews && elevationViews.length > 0) {
        elevationViews.forEach((view) => {
          view.range = 100 // Use same range as tutorial
          view.helpersVisible = false // Hide helpers for cleaner views
        })
      }

      console.log('Created elevation views:', elevationViews?.length || 0)

      console.log('Total views:', views.list.size)
      updateTableData()
      updateViewsTable({ components })
    } catch (error) {
      console.error('Error initializing views:', error)
    }
  }

  const onCloseView = () => {
    console.log('Closing active view...')
    try {
      views.close()

      // Ensure user input is enabled after closing view
      if (world?.camera && world.camera instanceof OBC.OrthoPerspectiveCamera) {
        world.camera.setUserInput(true)
      }

      console.log('View closed successfully')
    } catch (error) {
      console.error('Error closing view:', error)
    }
  }

  // const onShowDebugInfo = () => {
  //   const fragments = components.get(OBC.FragmentsManager);
  //   const modelIds = [...fragments.list.keys()];

  //   console.log("=== Views Debug Info ===");
  //   console.log("Views world:", views.world ? "Available" : "Not available");
  //   console.log("Loaded models:", modelIds);
  //   console.log("Current views:", [...views.list.keys()]);
  //   console.log("Views list size:", views.list.size);
  //   console.log("=======================");
  // };

  const onClearAllViews = () => {
    views.list.clear()
    updateTableData()
    updateViewsTable({ components })
  }

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.MODEL} label=${t(
    '2d-views'
  )} style="max-height: 400px; display: flex; flex-direction: column;">
      <div style="margin-bottom: 0.5rem; padding: 0.5rem; background-color: #f0f8ff; border-radius: 4px; font-size: 0.7rem; color: #666;">
        ${t('double-click-instruction')}
      </div>
      
      
      <div style="display: flex; gap: 0.375rem; flex-shrink: 0; margin-bottom: 0.5rem;">
        <bim-button @click=${onInitializeViews} label=${t(
    'initialize-views'
  )} icon=${appIcons.MODEL} style="flex: 1;"></bim-button>
      </div>
      <div style="display: flex; gap: 0.375rem; flex-shrink: 0; margin-bottom: 0.5rem;">
        <bim-button @click=${onCloseView} label=${t(
    'close-active-view'
  )} style="flex: 1;"></bim-button>
        <bim-button @click=${onClearAllViews} label=${t(
    'clear-all-views'
  )} style="flex: 1;"></bim-button>
      </div>
      <div style="flex: 1; overflow-y: auto; min-height: 0;">
        ${viewsTable}
      </div>
    </bim-panel-section>
  `
}
