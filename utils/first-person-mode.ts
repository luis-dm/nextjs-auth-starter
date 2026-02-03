import * as THREE from 'three'
import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import { RaycastUtils, BIMModel } from './raycastUtils'

// Define the PointerLockControls interface for TypeScript
interface IPointerLockControls {
  isLocked: boolean
  lock(): void
  unlock(): void
  disconnect(): void
  moveRight(distance: number): void
  moveForward(distance: number): void
  addEventListener(event: string, callback: () => void): void
  object: THREE.Camera
}

// We'll dynamically import PointerLockControls
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let PointerLockControlsClass: any = null

interface FirstPersonConfig {
  components: OBC.Components
  world: OBC.World
  t?: (key: string) => string // Add translation function
  onNoteCreate?: (result: any, position: { x: number; y: number; z: number }) => void // Callback for note creation
}

// State variables
let isFirstPersonActive = false
let currentWorld: OBC.World | null = null
let controls: IPointerLockControls | null = null
let camera: THREE.PerspectiveCamera | null = null
let oldCameraPosition: THREE.Vector3 | null = null
let oldCameraRotation: THREE.Euler | null = null
let keyState: { [key: string]: boolean } = {}
let elementNameDisplay: HTMLElement | null = null
let fragments: OBC.FragmentsManager | null = null
let highlighter: OBF.Highlighter | null = null
let config: FirstPersonConfig | null = null

// Movement variables
let moveForward = false
let moveBackward = false
let moveLeft = false
let moveRight = false
let moveUp = false
let moveDown = false
let moveSpeed = 10
let velocity = new THREE.Vector3()
let direction = new THREE.Vector3()
let prevTime = performance.now()
let animationId: number | null = null
let firstPersonCamera: THREE.PerspectiveCamera | null = null
let pointerLockControls: IPointerLockControls | null = null
let originalCameraPosition: THREE.Vector3 | null = null
let originalCameraRotation: THREE.Euler | null = null
let frustumUpdateInterval: number | null = null
let onPointerLockChange: (() => void) | null = null
let reticle: HTMLElement | null = null
let controlsInfo: HTMLElement | null = null

// Hidden UI elements for restoration
let hiddenElements: { element: HTMLElement; originalDisplay: string }[] = []

// Raycasting setup
// let sphereGeometry: THREE.SphereGeometry | null = null;
// let sphereMaterial: THREE.MeshLambertMaterial | null = null;

// Raycasting utility function for first-person mode
const raycastFromCenter = async () => {
  if (!currentWorld || !firstPersonCamera || !fragments) return null

  const canvas = currentWorld.renderer?.three.domElement
  if (!canvas) return null

  return RaycastUtils.raycastFromCenter(firstPersonCamera, canvas, fragments)
}

// Get element name using fragments model API (deprecated - use RaycastUtils.getElementName instead)
const getElementName = async (
  model: BIMModel,
  localId: number
): Promise<string | null> => {
  return RaycastUtils.getElementName(model, localId)
}

// Handle click events for highlighting elements
const onFirstPersonClick = async () => {
  if (!isFirstPersonActive || !currentWorld) return

  const raycastEntry = await raycastFromCenter()

  if (!raycastEntry) {
    // No raycast result - clear all highlights and hide element name

    // Clear highlighter selection
    if (highlighter) {
      await highlighter.clear('select')
    }

    // Clear highlights from the fragment model
    if (fragments && fragments.list.size > 0) {
      try {
        const model = fragments.list.values().next().value
        if (model?.resetHighlight) {
          await model.resetHighlight()
        }
        if (fragments.core) {
          await fragments.core.update(true)
        }
      } catch (error) {
        console.warn('Error clearing highlights:', error)
      }
    }

    // Hide element name display
    if (elementNameDisplay) {
      elementNameDisplay.style.display = 'none'
    }

    return
  }

  const { result, model } = raycastEntry
  console.log('Raycast result:', result)

  // Get the highlighter and highlight the clicked element using fragments model API
  if (highlighter && result && result.localId !== undefined) {
    try {
      // Clear previous selection
      await highlighter.clear('select')

      // Get element name
      const elementName = await getElementName(model, result.localId)
      console.log('Element name:', elementName || 'Unknown')

      // Show element name in UI
      showElementName(elementName || 'Unknown Element')

      // Use fragments model highlighting instead of external highlighter
      // Define highlight material similar to the tutorial
      const highlightMaterial = {
        color: new THREE.Color('#0278bd'),
        renderedFaces: 2, // TWO faces
        opacity: 1,
        transparent: false,
      }

      // Reset any previous highlights on this model
      if (model?.resetHighlight) {
        await model.resetHighlight()
      }

      // Highlight the selected element using the fragments model API
      if (model?.highlight) {
        await model.highlight([result.localId], highlightMaterial)
      }

      // Update fragments to show the highlight
      if (fragments?.core) {
        await fragments.core.update(true)
      }

      console.log('Element highlighted:', {
        localId: result.localId,
        name: elementName,
        model: model,
      })
    } catch (error) {
      console.error('Error highlighting element:', error)
    }
  }
}

// Handle note creation at raycast intersection
const onNoteCreate = async () => {
  if (!isFirstPersonActive || !currentWorld || !config?.onNoteCreate) return

  console.log('Creating note at raycast intersection...')

  const raycastEntry = await raycastFromCenter()
  
  if (!raycastEntry) {
    console.log('No intersection found for note creation')
    return
  }

  const { result, model } = raycastEntry
  console.log('Creating note at raycast result:', result)

  // Create the position object with world coordinates
  const worldPosition = {
    x: result.point.x,
    y: result.point.y,
    z: result.point.z
  }

  // Exit first person mode
  await exitFirstPersonMode()

  // Call the note creation callback with the raycast result and position
  config.onNoteCreate(result, worldPosition)
}

const onKeyDown = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true
      break
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true
      break
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true
      break
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true
      break
    case 'KeyQ':
      moveUp = true
      break
    case 'KeyE':
      moveDown = true
      break
    case 'Escape':
      // Exit first person mode immediately
      exitFirstPersonMode()
      break
    case 'KeyR':
      // Reset first-person camera position
      if (isFirstPersonActive && firstPersonCamera && currentWorld) {
        // Calculate model bounds for repositioning
        const modelBounds = new THREE.Box3().setFromObject(
          currentWorld.scene.three
        )
        const modelCenter = modelBounds.getCenter(new THREE.Vector3())
        const modelSize = modelBounds.getSize(new THREE.Vector3())

        // Reset camera to initial position
        firstPersonCamera.position.set(
          modelCenter.x,
          modelCenter.y + modelSize.y * 0.1,
          modelCenter.z + modelSize.z * 0.5
        )

        // Reset camera rotation to default (looking forward)
        firstPersonCamera.rotation.set(0, 0, 0)

        console.log('First-person camera position reset')
      }
      break
    case 'Space':
      // Place sphere at reticle position
      event.preventDefault() // Prevent page scroll
      onFirstPersonClick()
      break
    case 'KeyN':
      // Create note at raycast intersection
      event.preventDefault()
      onNoteCreate()
      break
    case 'Minus':
    case 'NumpadSubtract':
      // Decrease movement speed
      moveSpeed = Math.max(1, moveSpeed - 2) // Minimum speed of 1
      console.log('Speed decreased to:', moveSpeed)
      break
    case 'Equal':
    case 'NumpadAdd':
      // Increase movement speed
      moveSpeed = Math.min(50, moveSpeed + 2) // Maximum speed of 50
      console.log('Speed increased to:', moveSpeed)
      break
  }
}

const onKeyUp = (event: KeyboardEvent) => {
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false
      break
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false
      break
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false
      break
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false
      break
    case 'KeyQ':
      moveUp = false
      break
    case 'KeyE':
      moveDown = false
      break
    case 'Space':
      // Handle spacebar release - no long press logic needed
      break
  }
}

const animate = () => {
  if (
    !isFirstPersonActive ||
    !pointerLockControls ||
    !firstPersonCamera ||
    !currentWorld
  )
    return

  animationId = requestAnimationFrame(animate)

  const time = performance.now()

  if (pointerLockControls.isLocked === true) {
    const delta = (time - prevTime) / 1000

    // Get camera's forward and right vectors
    const camera = firstPersonCamera
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    )
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0) // World up vector for vertical movement

    // Calculate movement vector
    const movement = new THREE.Vector3()

    if (moveForward)
      movement.add(forward.clone().multiplyScalar(moveSpeed * delta))
    if (moveBackward)
      movement.add(forward.clone().multiplyScalar(-moveSpeed * delta))
    if (moveRight) movement.add(right.clone().multiplyScalar(moveSpeed * delta))
    if (moveLeft) movement.add(right.clone().multiplyScalar(-moveSpeed * delta))
    if (moveUp) movement.add(up.clone().multiplyScalar(moveSpeed * delta))
    if (moveDown) movement.add(up.clone().multiplyScalar(-moveSpeed * delta))

    // Apply movement to camera position
    camera.position.add(movement)

    // Update camera matrix after movement for proper frustum culling
    camera.updateMatrixWorld(true)
  }

  prevTime = time

  // Render the scene
  if (currentWorld.renderer) {
    currentWorld.renderer.three.render(
      currentWorld.scene.three,
      firstPersonCamera
    )
  }
}

// Periodic frustum and visibility update function
const updateFragmentVisibility = async () => {
  if (!isFirstPersonActive || !fragments || !firstPersonCamera) return

  try {
    // Update camera matrices to ensure proper frustum calculation
    firstPersonCamera.updateMatrixWorld(true)
    firstPersonCamera.updateProjectionMatrix()

    // Update fragments core to refresh visibility and culling
    if (fragments.core) {
      await fragments.core.update(true)
    }

    // For each model, refresh its state without affecting highlights
    if (fragments.list && fragments.list.size > 0) {
      for (const model of fragments.list.values()) {
        if (model?.useCamera) {
          // Refresh camera reference for the model
          model.useCamera(firstPersonCamera)
        }
      }
    }
  } catch (error) {
    console.warn('Error updating fragment visibility:', error)
  }
}

const createReticle = () => {
  const reticleDiv = document.createElement('div')
  reticleDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    background: white;
    border: 2px solid black;
    border-radius: 50%;
    z-index: 10002;
    pointer-events: none;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
  `

  // Add crosshair lines
  const horizontalLine = document.createElement('div')
  horizontalLine.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 1px;
    background: white;
    box-shadow: 0 0 2px black;
  `

  const verticalLine = document.createElement('div')
  verticalLine.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 1px;
    height: 20px;
    background: white;
    box-shadow: 0 0 2px black;
  `

  reticleDiv.appendChild(horizontalLine)
  reticleDiv.appendChild(verticalLine)
  document.body.appendChild(reticleDiv)
  return reticleDiv
}

const createControlsInfo = (t?: (key: string) => string) => {
  const controlsDiv = document.createElement('div')

  // Default English translations as fallback
  const getText = (key: string, fallback: string) => (t ? t(key) : fallback)

  controlsDiv.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      max-width: 280px;
      backdrop-filter: blur(5px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div style="font-weight: bold; margin-bottom: 8px; color: #fff;">${getText(
        'fp-controls',
        'CONTROLS'
      )}</div>
      <div style="margin-bottom: 4px;"><strong>${getText(
        'fp-movement',
        'Movement:'
      )}</strong></div>
      <div style="margin-bottom: 6px; color: #ccc;">
        • ${getText('fp-movement-desc', 'W/A/S/D or Arrow Keys - Move')}
      </div>
      <div style="margin-bottom: 4px;"><strong>${getText(
        'fp-camera',
        'Camera:'
      )}</strong></div>
      <div style="margin-bottom: 6px; color: #ccc;">
        • ${getText('fp-camera-desc', 'Mouse - Look around')}
      </div>
      <div style="margin-bottom: 4px;"><strong>${getText(
        'fp-actions',
        'Actions:'
      )}</strong></div>
      <div style="color: #ccc;">
        • ${getText(
          'fp-actions-space',
          'SPACE - Highlight element at reticle & show name'
        )}<br>
        • ${getText('fp-actions-note', 'N - Create note at reticle position')}<br>
        • ${getText('fp-actions-reset', 'R - Reset camera position')}<br>
        • ${getText('fp-actions-speed', '-/+ - Decrease/Increase speed')}<br>
        • ${getText('fp-actions-exit', 'ESC - Exit first person mode')}
      </div>
    </div>
  `

  document.body.appendChild(controlsDiv)
  return controlsDiv
}

const createElementNameDisplay = () => {
  const nameDiv = document.createElement('div')
  nameDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    max-width: 400px;
    text-align: center;
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: none;
    pointer-events: none;
  `
  nameDiv.textContent = ''
  document.body.appendChild(nameDiv)
  return nameDiv
}

const showElementName = (name: string) => {
  if (elementNameDisplay) {
    elementNameDisplay.textContent = name
    elementNameDisplay.style.display = 'block'

    // Auto-hide after 3 seconds
    // setTimeout(() => {
    //   if (elementNameDisplay) {
    //     elementNameDisplay.style.display = "none";
    //   }
    // }, 3000);
  }
}

const hideUIElements = () => {
  // List of selectors for UI elements to hide - be more specific to avoid hiding the 3D viewer
  const selectorsToHide = [
    // Spatial and Chatbot panels
    '.spatial-tree-panel',
    '.chatbot-panel',
    // Custom toolbar panel (bottom center)
    '[class*="customToolbar"]',
    // BUI toolbar with Tailwind classes
    '.flex.items-center.justify-evenly.p-3.bg-white.border.border-gray-200.shadow-sm.rounded-lg.w-full',
    'div.toolbar-button',
    // Generic floating button classes
    '.fixed.w-\\[50px\\].h-\\[50px\\].rounded-full',
    'button.fixed.top-20.right-8', // Search button
    'button.fixed.top-\\[8\\.5rem\\].right-8', // Properties button
    'button.fixed.top-48.right-8', // Raycast button
    // Note markers - using actual CSS module classes from NoteManager
    '[class*="NoteManager_marker"]',
    '[class*="marker"]',
    // CSS2D renderer dom element - this should hide all CSS2D rendered content
    '.css2d-object',
    'div[style*="pointer-events: none"]', // CSS2DRenderer container
    // Note form overlay
    '[class*="NoteFormOverlay"]',
    '[class*="noteFormOverlay"]',
    // Bottom toolbar
    'bim-toolbar',
    // Original BIM panels (keeping for backwards compatibility)
    'bim-panel-section[label="Models"]',
    'bim-panel-section[label="モデル"]', // Japanese version
    'bim-panel-section[label="Spatial Tree"]',
    'bim-panel-section[label="空間ツリー"]', // Japanese version
    'bim-panel-section[label="AI Assistant"]',
    'bim-panel-section[label="AIアシスタント"]', // Japanese version
    'bim-panel-section[data-panel-id="models"]',
    'bim-panel-section[data-panel-id="spatial-tree"]',
    'bim-panel-section[data-panel-id="ai-assistant"]',
    // 2D Views panel
    'bim-panel-section[label="2D Views"]',
    'bim-panel-section[label="2Dビュー"]', // Japanese version
    'bim-panel-section[data-panel-id="2d-views"]',
    // Right sidebar panels
    'bim-panel-section[label="Selection Data"]',
    'bim-panel-section[label="選択データ"]', // Japanese version
    'bim-panel-section[data-panel-id="selection-data"]',
    // Language switcher
    '.language-switcher',
    // Specific grid containers but not the main viewer
    'bim-grid > bim-panel:first-child', // Left sidebar
    'bim-grid > bim-panel:last-child', // Right sidebar
  ]

  selectorsToHide.forEach((selector) => {
    const elements = document.querySelectorAll(selector)
    elements.forEach((element) => {
      const htmlElement = element as HTMLElement
      // Additional check to ensure we don't hide the canvas or main viewer
      const hasCanvas = htmlElement.querySelector('canvas')
      const isViewerContainer =
        htmlElement.classList.contains('viewer') ||
        htmlElement.tagName.toLowerCase() === 'canvas' ||
        htmlElement.getAttribute('role') === 'main'

      if (
        htmlElement &&
        !hasCanvas &&
        !isViewerContainer &&
        htmlElement.style.display !== 'none'
      ) {
        hiddenElements.push({
          element: htmlElement,
          originalDisplay: htmlElement.style.display || '',
        })
        htmlElement.style.display = 'none'
      }
    })
  })

  // Additional specific targeting for floating buttons by position/style
  const allButtons = document.querySelectorAll('button')
  allButtons.forEach((button) => {
    const htmlButton = button as HTMLElement
    const computedStyle = window.getComputedStyle(htmlButton)

    // Target floating buttons that are fixed positioned on the right side
    if (
      computedStyle.position === 'fixed' &&
      computedStyle.borderRadius === '50%' &&
      (computedStyle.right === '32px' || computedStyle.right === '2rem') &&
      (computedStyle.top === '80px' ||
        computedStyle.top === '5rem' ||
        computedStyle.top === '136px' ||
        computedStyle.top === '8.5rem' ||
        computedStyle.top === '192px' ||
        computedStyle.top === '12rem') &&
      htmlButton.style.display !== 'none'
    ) {
      hiddenElements.push({
        element: htmlButton,
        originalDisplay: htmlButton.style.display || '',
      })
      htmlButton.style.display = 'none'
    }
  })

  // Specific targeting for CSS2D rendered note markers
  // The CSS2DRenderer creates a div with position: absolute and pointer-events: none
  const css2dElements = document.querySelectorAll(
    'div[style*="position: absolute"][style*="pointer-events: none"]'
  )
  css2dElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    // Only target elements that contain note markers (have Material Icons or article content)
    if (
      htmlElement.querySelector('.material-symbols-outlined') ||
      htmlElement.textContent?.includes('article') ||
      htmlElement.querySelector('[class*="marker"]')
    ) {
      if (htmlElement.style.display !== 'none') {
        hiddenElements.push({
          element: htmlElement,
          originalDisplay: htmlElement.style.display || '',
        })
        htmlElement.style.display = 'none'
      }
    }
  })

  // Hide body overflow to prevent scrolling
  document.body.style.overflow = 'hidden'
}

const restoreUIElements = () => {
  // Restore all hidden elements
  hiddenElements.forEach(({ element, originalDisplay }) => {
    element.style.display = originalDisplay
  })
  hiddenElements = []

  // Restore body overflow
  document.body.style.overflow = ''
}

export const enterFirstPersonMode = async (configParam: FirstPersonConfig) => {
  const { components, world, t } = configParam
  
  // Store config globally for use in other functions
  config = configParam

  if (isFirstPersonActive) return

  try {
    // Dynamically import PointerLockControls
    if (!PointerLockControlsClass) {
      const { PointerLockControls } = await import(
        'three/examples/jsm/controls/PointerLockControls.js'
      )
      PointerLockControlsClass = PointerLockControls
    }
  } catch (error) {
    console.error('Failed to load PointerLockControls:', error)
    alert(
      'First Person View requires PointerLockControls from Three.js examples. Please ensure it is available.'
    )
    return
  }

  isFirstPersonActive = true
  currentWorld = world
  highlighter = components.get(OBF.Highlighter)

  // Get fragments manager for raycasting
  try {
    fragments = components.get(OBC.FragmentsManager)
    console.log('Fragments manager initialized for raycasting')
  } catch (error) {
    console.warn('FragmentsManager not available, raycasting disabled:', error)
    fragments = null
  }

  // Store original camera state
  if (world.camera instanceof OBC.SimpleCamera) {
    originalCameraPosition = world.camera.three.position.clone()
    originalCameraRotation = world.camera.three.rotation.clone()

    // Disable the world's camera controls
    if (world.camera.controls) {
      world.camera.controls.enabled = false
    }
  }

  // Create first person camera
  firstPersonCamera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )

  // Calculate model bounds for initial positioning
  const modelBounds = new THREE.Box3().setFromObject(world.scene.three)
  const modelCenter = modelBounds.getCenter(new THREE.Vector3())
  const modelSize = modelBounds.getSize(new THREE.Vector3())

  // Position camera at a reasonable height and distance
  firstPersonCamera.position.set(
    modelCenter.x,
    modelCenter.y + modelSize.y * 0.1,
    modelCenter.z + modelSize.z * 0.5
  )

  // Set the first person camera for the loaded model
  if (fragments && fragments.list.size > 0) {
    const model = fragments.list.values().next().value
    if (model) {
      model.useCamera(firstPersonCamera)
      console.log('First person camera set for the loaded model')
    }
  }

  // Create pointer lock controls
  if (!world.renderer) {
    console.error('World renderer is not available')
    return
  }

  const container =
    world.renderer.three.domElement.parentElement || document.body
  pointerLockControls = new PointerLockControlsClass(
    firstPersonCamera,
    container
  )

  // Add listener for pointer lock changes - exit when unlocked by ESC
  onPointerLockChange = () => {
    if (
      pointerLockControls &&
      !pointerLockControls.isLocked &&
      isFirstPersonActive
    ) {
      // If pointer was unlocked and we're still in first person mode, exit
      exitFirstPersonMode()
    }
  }

  document.addEventListener('pointerlockchange', onPointerLockChange)
  document.addEventListener('mozpointerlockchange', onPointerLockChange)
  document.addEventListener('webkitpointerlockchange', onPointerLockChange)

  // Hide UI panels
  hideUIElements()

  // Create UI elements
  reticle = createReticle()
  controlsInfo = createControlsInfo(t)
  elementNameDisplay = createElementNameDisplay()
  elementNameDisplay = createElementNameDisplay()

  // Add event listeners
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)

  // Make canvas fullscreen
  if (world.renderer) {
    const canvas = world.renderer.three.domElement
    if (canvas) {
      canvas.style.position = 'fixed'
      canvas.style.top = '0'
      canvas.style.left = '0'
      canvas.style.width = '100vw'
      canvas.style.height = '100vh'
      canvas.style.zIndex = '1'
    }
  }

  // Lock pointer after a short delay
  setTimeout(() => {
    if (pointerLockControls) {
      pointerLockControls.lock()
    }
  }, 100)

  // Start animation loop
  animate()

  // Start periodic frustum culling updates every 500ms (half second)
  frustumUpdateInterval = window.setInterval(updateFragmentVisibility, 500)
  console.log('First-person mode: Started periodic visibility updates')
}

export const exitFirstPersonMode = async () => {
  if (!isFirstPersonActive) return

  isFirstPersonActive = false

  // Stop animation loop
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // Stop periodic frustum updates
  if (frustumUpdateInterval !== null) {
    clearInterval(frustumUpdateInterval)
    frustumUpdateInterval = null
    console.log('First-person mode: Stopped periodic visibility updates')
  }

  // Remove event listeners
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)

  // Remove pointer lock change listeners
  if (onPointerLockChange) {
    document.removeEventListener('pointerlockchange', onPointerLockChange)
    document.removeEventListener('mozpointerlockchange', onPointerLockChange)
    document.removeEventListener('webkitpointerlockchange', onPointerLockChange)
    onPointerLockChange = null
  }

  // Clear any highlights from the fragment model on exit
  if (fragments && fragments.list.size > 0) {
    try {
      const model = fragments.list.values().next().value
      if (model?.resetHighlight) {
        await model.resetHighlight()
      }
      if (fragments.core) {
        await fragments.core.update(true)
      }
    } catch (error) {
      console.warn('Error clearing highlights on exit:', error)
    }
  }

  // Also clear highlighter selection if available
  if (highlighter) {
    await highlighter.clear('select')
  }

  // Remove UI elements
  if (reticle) {
    reticle.remove()
    reticle = null
  }

  if (controlsInfo) {
    controlsInfo.remove()
    controlsInfo = null
  }

  if (elementNameDisplay) {
    ;(elementNameDisplay as HTMLElement).remove()
    elementNameDisplay = null
  }

  // Dispose pointer lock controls and explicitly unlock
  if (pointerLockControls) {
    // Force unlock pointer if it's still locked
    if (pointerLockControls.isLocked) {
      document.exitPointerLock()
    }
    pointerLockControls.disconnect()
    pointerLockControls = null
  }

  // Restore UI elements
  restoreUIElements()

  // Restore canvas to normal positioning
  const canvas = currentWorld?.renderer?.three?.domElement
  if (canvas) {
    canvas.style.position = ''
    canvas.style.top = ''
    canvas.style.left = ''
    canvas.style.width = ''
    canvas.style.height = ''
    canvas.style.zIndex = ''
  }

  // Restore the world camera
  if (currentWorld && originalCameraPosition && originalCameraRotation) {
    if (currentWorld.camera instanceof OBC.SimpleCamera) {
      currentWorld.camera.three.position.copy(originalCameraPosition)
      currentWorld.camera.three.rotation.copy(originalCameraRotation)

      // Re-enable camera controls
      if (currentWorld.camera.controls) {
        currentWorld.camera.controls.enabled = true
      }

      // Restore the world camera for the loaded model
      if (fragments && fragments.list.size > 0) {
        const model = fragments.list.values().next().value
        if (model?.useCamera) {
          model.useCamera(currentWorld.camera.three)
          console.log('World camera restored for the loaded model')
        }
      }

      // Update camera controls if they exist
      if (currentWorld.camera.controls && currentWorld.camera.controls.update) {
        currentWorld.camera.controls.update(0)
      }

      // Force the world to restart its normal rendering cycle
      if (currentWorld.renderer) {
        // Set the camera back on the renderer
        currentWorld.renderer.three.render(
          currentWorld.scene.three,
          currentWorld.camera.three
        )

        // Trigger a resize to force the world to recalculate camera aspects
        const canvas = currentWorld.renderer.three.domElement
        if (canvas) {
          const resizeEvent = new Event('resize')
          window.dispatchEvent(resizeEvent)
        }
      }

      // Force camera matrix updates
      currentWorld.camera.three.updateProjectionMatrix()
      currentWorld.camera.three.updateMatrixWorld(true)
    }
  }

  // Clean up first person camera
  if (firstPersonCamera) {
    firstPersonCamera = null
  }

  // Reset movement variables
  moveForward = false
  moveBackward = false
  moveLeft = false
  moveRight = false
  moveUp = false
  moveDown = false
  moveSpeed = 10 // Reset to default speed
  velocity.set(0, 0, 0)
  direction.set(0, 0, 0)
  prevTime = performance.now()

  // Clear stored variables
  originalCameraPosition = null
  originalCameraRotation = null
  currentWorld = null
  highlighter = null
  fragments = null
  frustumUpdateInterval = null
}

export const isFirstPersonModeActive = () => isFirstPersonActive
