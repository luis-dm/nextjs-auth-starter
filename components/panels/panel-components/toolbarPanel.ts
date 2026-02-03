import * as BUI from '@thatopen/ui'
import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import * as FRAGS from '@thatopen/fragments'
import {
  enterFirstPersonMode,
  exitFirstPersonMode,
  isFirstPersonModeActive,
} from '@/utils/first-person-mode'

export interface ViewerToolbarState {
  components: OBC.Components
  world: OBC.World
  t: (key: string) => string
  onNoteCreateRequest?: (
    position: { x: number; y: number; z: number },
    localId?: number
  ) => void
}

const originalColors = new Map<
  FRAGS.BIMMaterial,
  { color: number; transparent: boolean; opacity: number }
>()

const setModelTransparent = (components: OBC.Components) => {
  const fragments = components.get(OBC.FragmentsManager)

  const materials = [...fragments.core.models.materials.list.values()]
  for (const material of materials) {
    if (material.userData.customId) continue
    // save colors
    let color: number | undefined
    if ('color' in material) {
      color = material.color.getHex()
    } else {
      color = material.lodColor.getHex()
    }

    originalColors.set(material, {
      color,
      transparent: material.transparent,
      opacity: material.opacity,
    })

    // set color
    material.transparent = true
    material.opacity = 0.05
    material.needsUpdate = true
    if ('color' in material) {
      material.color.setColorName('white')
    } else {
      material.lodColor.setColorName('white')
    }
  }
}

const restoreModelMaterials = () => {
  for (const [material, data] of originalColors) {
    const { color, transparent, opacity } = data
    material.transparent = transparent
    material.opacity = opacity
    if ('color' in material) {
      material.color.setHex(color)
    } else {
      material.lodColor.setHex(color)
    }
    material.needsUpdate = true
  }
  originalColors.clear()
}

export const viewerToolbarTemplate: BUI.StatefullComponent<
  ViewerToolbarState
> = (state, update) => {
  const { components, world, t } = state

  const highlighter = components.get(OBF.Highlighter)
  const hider = components.get(OBC.Hider)
  const lengthMeasurer = components.get(OBF.LengthMeasurement)
  const areaMeasurer = components.get(OBF.AreaMeasurement)
  const clipper = components.get(OBC.Clipper)

  // Initialize measurement tools with the world
  lengthMeasurer.world = world
  areaMeasurer.world = world

  // Clipper is already initialized with components, just ensure it's ready
  if (!clipper.enabled) {
    clipper.enabled = false // Ensure it's properly initialized
  }

  const disableAll = (exceptions?: ('clipper' | 'length' | 'area')[]) => {
    BUI.ContextMenu.removeMenus()
    highlighter.clear('select')
    highlighter.enabled = false
    if (!exceptions?.includes('length')) lengthMeasurer.enabled = false
    if (!exceptions?.includes('area')) areaMeasurer.enabled = false
    if (!exceptions?.includes('clipper')) clipper.enabled = false
  }

  const onLengthMeasurement = () => {
    const wasEnabled = lengthMeasurer.enabled
    disableAll(['length'])
    lengthMeasurer.enabled = !wasEnabled
    highlighter.enabled = !lengthMeasurer.enabled
    update()
  }

  const onAreaMeasurement = () => {
    const wasEnabled = areaMeasurer.enabled
    disableAll(['area'])
    areaMeasurer.enabled = !wasEnabled
    highlighter.enabled = !areaMeasurer.enabled
    update()
  }

  const onModelSection = () => {
    const wasEnabled = clipper.enabled
    disableAll(['clipper'])
    clipper.enabled = !wasEnabled
    highlighter.enabled = !clipper.enabled
    update()
  }

  const onToggleGhost = () => {
    if (originalColors.size) {
      restoreModelMaterials()
    } else {
      setModelTransparent(components)
    }
  }

  const onToggleFirstPerson = async () => {
    if (isFirstPersonModeActive()) {
      await exitFirstPersonMode()
    } else {
      await enterFirstPersonMode({
        components,
        world,
        t,
        onNoteCreate: (result, position) => {
          console.log('Note creation requested at position:', position)
          console.log('Raycast result:', result)

          // Call the callback to open the note overlay, passing localId from result
          if (state.onNoteCreateRequest) {
            state.onNoteCreateRequest(position, result?.localId)
          } else {
            console.warn('onNoteCreateRequest callback not provided')
          }
        },
      })
    }
  }

  let focusBtn: BUI.TemplateResult | undefined
  if (world.camera instanceof OBC.SimpleCamera) {
    const onFocus = async (event: Event) => {
      if (!(world.camera instanceof OBC.SimpleCamera)) return
      const button = event.currentTarget as HTMLElement
      const selection = highlighter.selection.select
      button.classList.add('loading')
      await world.camera.fitToItems(
        OBC.ModelIdMapUtils.isEmpty(selection) ? undefined : selection
      )
      button.classList.remove('loading')
    }

    focusBtn = BUI.html`
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50" @click=${onFocus} title="${t(
      'tooltip-focus-camera'
    )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">filter_center_focus</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'focus'
        )}</span>
      </div>`
  }

  const onHide = async (event: Event) => {
    const button = event.currentTarget as HTMLElement
    const selection = highlighter.selection.select
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return
    button.classList.add('loading')
    await hider.set(false, selection)
    button.classList.remove('loading')
  }

  const onIsolate = async (event: Event) => {
    const button = event.currentTarget as HTMLElement
    const selection = highlighter.selection.select
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return
    button.classList.add('loading')
    await hider.isolate(selection)
    button.classList.remove('loading')
  }

  const onShowAll = async (event: Event) => {
    const button = event.currentTarget as HTMLElement
    button.classList.add('loading')
    await hider.set(true)
    await highlighter.clear('select')

    // Clear all colorized elements by removing all styles except "select"
    for (const [styleName] of highlighter.styles) {
      if (styleName !== 'select') {
        await highlighter.clear(styleName)
      }
    }

    // Also fit camera to all items like when nothing is selected
    if (world.camera instanceof OBC.SimpleCamera) {
      await world.camera.fitToItems(undefined)
    }
    button.classList.remove('loading')
  }

  // Handlers for length, area, and section with toggle functionality
  const onLength = (event: Event) => {
    const button = event.currentTarget as HTMLElement

    // Clear all measurement button active states first
    document.querySelectorAll('.toolbar-button').forEach((btn) => {
      const htmlBtn = btn as HTMLElement
      const btnIcon = htmlBtn.querySelector('.material-icons') as HTMLElement
      if (
        btnIcon &&
        (btnIcon.textContent === 'straighten' ||
          btnIcon.textContent === 'crop_free' ||
          btnIcon.textContent === 'content_cut')
      ) {
        htmlBtn.classList.remove('active')
      }
    })

    // Toggle this button based on current state
    const wasEnabled = lengthMeasurer.enabled
    if (!wasEnabled) {
      button.classList.add('active')
    }

    onLengthMeasurement()
  }

  const onArea = (event: Event) => {
    const button = event.currentTarget as HTMLElement

    // Clear all measurement button active states first
    document.querySelectorAll('.toolbar-button').forEach((btn) => {
      const htmlBtn = btn as HTMLElement
      const btnIcon = htmlBtn.querySelector('.material-icons') as HTMLElement
      if (
        btnIcon &&
        (btnIcon.textContent === 'straighten' ||
          btnIcon.textContent === 'crop_free' ||
          btnIcon.textContent === 'content_cut')
      ) {
        htmlBtn.classList.remove('active')
      }
    })

    // Toggle this button based on current state
    const wasEnabled = areaMeasurer.enabled
    if (!wasEnabled) {
      button.classList.add('active')
    }

    onAreaMeasurement()
  }

  const onSection = (event: Event) => {
    const button = event.currentTarget as HTMLElement

    // Clear all measurement button active states first
    document.querySelectorAll('.toolbar-button').forEach((btn) => {
      const htmlBtn = btn as HTMLElement
      const btnIcon = htmlBtn.querySelector('.material-icons') as HTMLElement
      if (
        btnIcon &&
        (btnIcon.textContent === 'straighten' ||
          btnIcon.textContent === 'crop_free' ||
          btnIcon.textContent === 'content_cut')
      ) {
        htmlBtn.classList.remove('active')
      }
    })

    // Toggle this button based on current state
    const wasEnabled = clipper.enabled
    if (!wasEnabled) {
      button.classList.add('active')
    }

    onModelSection()
  }

  return BUI.html`
    <div class="flex items-center justify-evenly p-3 bg-white border border-gray-200 shadow-sm rounded-lg w-full">
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50 [&.active_.material-icons]:text-[#3870D5] [&.active_.button-label]:text-[#3870D5]" @click=${onLength} title="${t(
    'length'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">straighten</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'length'
        )}</span>
      </div>
      
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50 [&.active_.material-icons]:text-[#3870D5] [&.active_.button-label]:text-[#3870D5]" @click=${onArea} title="${t(
    'area'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">crop_free</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'area'
        )}</span>
      </div>
      
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50 [&.active_.material-icons]:text-[#3870D5] [&.active_.button-label]:text-[#3870D5]" @click=${onSection} title="${t(
    'section'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">content_cut</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'section'
        )}</span>
      </div>
      
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50" @click=${onToggleGhost} title="${t(
    'tooltip-ghost-transparent'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">opacity</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'transparent'
        )}</span>
      </div>
      
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50" @click=${onToggleFirstPerson} title="${t(
    'tooltip-first-person-nav'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">videocam</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'first-person'
        )}</span>
      </div>
      
      ${focusBtn}
      
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50" @click=${onIsolate} title="${t(
    'tooltip-isolate-selected'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">select_all</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'isolate'
        )}</span>
      </div>
      
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50" @click=${onHide} title="${t(
    'tooltip-hide-selected'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">visibility_off</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'hide'
        )}</span>
      </div>
      
      <div class="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50" @click=${onShowAll} title="${t(
    'tooltip-show-all-visible'
  )}">
        <span class="material-icons text-xl mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out">visibility</span>
        <span class="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">${t(
          'reset-view'
        )}</span>
      </div>
    </div>
  `
}
