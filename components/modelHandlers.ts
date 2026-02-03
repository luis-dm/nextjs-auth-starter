'use client'

import * as OBC from '@thatopen/components'
import * as OBF from '@thatopen/components-front'
import * as THREE from 'three'

export function uiHandlers(
  components: OBC.Components,
  world: OBC.World,
  viewport: HTMLElement
) {
  const highlighter = components.get(OBF.Highlighter)
  highlighter.setup({
    world,
    selectMaterialDefinition: {
      color: new THREE.Color('#3870D5'),
      renderedFaces: 1,
      opacity: 1,
      transparent: false,
    },
  })

  const hoverer = components.get(OBF.Hoverer)
  hoverer.world = world
  hoverer.enabled = true
  hoverer.material = new THREE.MeshBasicMaterial({
    color: '#3870D5',
    transparent: true, // transparent must be true to allow the animation
    opacity: 0.5, // this will act as the maximum possible opacity when animating
    depthTest: false, // recommended to avoid z-fighting
  })

  // Clipper Setup
  const clipper = components.get(OBC.Clipper)

  // Get measurement tools early for double-click handling
  const lengthMeasurer = components.get(OBF.LengthMeasurement)
  const areaMeasurer = components.get(OBF.AreaMeasurement)

  // Length Measurement Setup
  lengthMeasurer.world = world
  lengthMeasurer.color = new THREE.Color('#3870D5')

  lengthMeasurer.list.onItemAdded.add((line) => {
    const center = new THREE.Vector3()
    line.getCenter(center)
    const radius = line.distance() / 3
    const sphere = new THREE.Sphere(center, radius)
    world.camera.controls?.fitToSphere(sphere, true)
  })

  // Area Measurement Setup
  areaMeasurer.world = world
  areaMeasurer.color = new THREE.Color('#3870D5')

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  // Function to manage touch-action CSS property
  const updateTouchAction = () => {
    const isMeasuring =
      lengthMeasurer.enabled || areaMeasurer.enabled || clipper.enabled
    if (isTouchDevice && isMeasuring) {
      viewport.style.touchAction = 'none'
      document.body.style.overflow = 'hidden'
    } else {
      viewport.style.touchAction = 'auto'
      document.body.style.overflow = 'auto'
    }
  }

  // Set up initial touch action
  updateTouchAction()

  // Monitor measurement tool state changes
  let lastMeasurementState = false
  const checkMeasurementState = () => {
    const currentState =
      lengthMeasurer.enabled || areaMeasurer.enabled || clipper.enabled
    if (currentState !== lastMeasurementState) {
      lastMeasurementState = currentState
      updateTouchAction()
    }
  }

  // Check measurement state periodically
  const measurementStateInterval = setInterval(checkMeasurementState, 100)

  let lastTapTime = 0
  let tapTimeout: NodeJS.Timeout | null = null
  let isLongPress = false
  let longPressTimeout: NodeJS.Timeout | null = null

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return

    // Prevent page scrolling when measuring
    if (lengthMeasurer.enabled || areaMeasurer.enabled || clipper.enabled) {
      event.preventDefault()
    }

    const currentTime = Date.now()
    const timeSinceLastTap = currentTime - lastTapTime

    if (tapTimeout) {
      clearTimeout(tapTimeout)
      tapTimeout = null
    }

    if (longPressTimeout) {
      clearTimeout(longPressTimeout)
      longPressTimeout = null
    }

    isLongPress = false

    longPressTimeout = setTimeout(() => {
      isLongPress = true
      handleLongPress(event)
      if (tapTimeout) {
        clearTimeout(tapTimeout)
        tapTimeout = null
      }
    }, 800)

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout)
        longPressTimeout = null
      }
      handleDoubleTap(event)
      lastTapTime = 0
      return
    }

    lastTapTime = currentTime
    tapTimeout = setTimeout(() => {
      if (!isLongPress) {
        handleSingleTap(event)
      }
      tapTimeout = null
    }, 300)
  }

  const handleTouchEnd = (event: TouchEvent) => {
    // Prevent page scrolling when measuring
    if (lengthMeasurer.enabled || areaMeasurer.enabled || clipper.enabled) {
      event.preventDefault()
    }

    if (longPressTimeout) {
      clearTimeout(longPressTimeout)
      longPressTimeout = null
    }
  }

  const handleTouchMove = (event: TouchEvent) => {
    // Prevent page scrolling when measuring
    if (lengthMeasurer.enabled || areaMeasurer.enabled || clipper.enabled) {
      event.preventDefault()
    }

    if (longPressTimeout) {
      clearTimeout(longPressTimeout)
      longPressTimeout = null
      isLongPress = false
    }
  }

  const handleSingleTap = (event: TouchEvent) => {
    if (lengthMeasurer.enabled) {
      lengthMeasurer.create()
    } else if (areaMeasurer.enabled) {
      areaMeasurer.create()
    }
  }

  const handleDoubleTap = (event: TouchEvent) => {
    event.preventDefault()

    if (lengthMeasurer.enabled) {
      lengthMeasurer.endCreation()
    } else if (areaMeasurer.enabled) {
      areaMeasurer.endCreation()
    } else if (clipper.enabled) {
      clipper.create(world)
    }
  }

  const handleLongPress = (event: TouchEvent) => {
    event.preventDefault()

    if (clipper.enabled) {
      clipper.deleteAll()
    }
    if (lengthMeasurer.enabled) {
      lengthMeasurer.list.clear()
    }
    if (areaMeasurer.enabled) {
      areaMeasurer.list.clear()
    }
  }

  const handleDoubleClick = () => {
    if (lengthMeasurer.enabled) {
      lengthMeasurer.create()
    } else if (areaMeasurer.enabled) {
      areaMeasurer.create()
    } else if (clipper.enabled) {
      clipper.create(world)
      clipper.config.color = new THREE.Color('#000000')
      clipper.config.opacity = 0.8
      clipper.config.size = 15
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!world?.renderer) return

    if (event.code === 'Delete' || event.code === 'Backspace') {
      clipper.delete(world)
      lengthMeasurer.delete()
      areaMeasurer.delete()
    } else if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      if (lengthMeasurer.enabled) {
        lengthMeasurer.endCreation()
      } else if (areaMeasurer.enabled) {
        areaMeasurer.endCreation()
      }
    }
  }

  if (!isTouchDevice) {
    viewport.addEventListener('dblclick', handleDoubleClick)
  }

  viewport.addEventListener('touchstart', handleTouchStart, { passive: false })
  viewport.addEventListener('touchend', handleTouchEnd, { passive: false })
  viewport.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('keydown', handleKeyDown)

  return () => {
    if (tapTimeout) clearTimeout(tapTimeout)
    if (longPressTimeout) clearTimeout(longPressTimeout)
    clearInterval(measurementStateInterval)

    // Restore CSS properties
    viewport.style.touchAction = 'auto'
    document.body.style.overflow = 'auto'

    if (!isTouchDevice) {
      viewport.removeEventListener('dblclick', handleDoubleClick)
    }
    viewport.removeEventListener('touchstart', handleTouchStart)
    viewport.removeEventListener('touchend', handleTouchEnd)
    viewport.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('keydown', handleKeyDown)
  }
}
