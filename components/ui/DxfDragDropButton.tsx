import React, { useState, useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { DxfViewer } from 'dxf-viewer'

interface DxfDragDropButtonProps {
  onDrop?: (position: { x: number; y: number }) => void
  dxfViewerRef?: React.RefObject<DxfViewer | null>
  disabled?: boolean
}

export function DxfDragDropButton({
  onDrop,
  dxfViewerRef,
  disabled = false,
}: DxfDragDropButtonProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  // Function to create a marker mesh at world coordinates
  const createMarkerMesh = useCallback(
    (worldPosition: THREE.Vector3) => {
      if (!dxfViewerRef?.current) return null

      // Create a small sphere as a marker
      const geometry = new THREE.SphereGeometry(0.5, 16, 16)

      // Use a simple material that's compatible with DXF viewer
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Red color
        transparent: true,
        opacity: 0.8,
      })

      // Add the onBuild function that DXF viewer expects
      ;(material as any).onBuild = function () {
        // Empty function to satisfy DXF viewer requirements
      }

      const marker = new THREE.Mesh(geometry, material)

      // Position the marker
      marker.position.copy(worldPosition)
      marker.name = `marker_${Date.now()}` // Unique name for the marker

      // Add to the DXF viewer's scene
      try {
        // Access the THREE.js scene from the DXF viewer
        const viewer = dxfViewerRef.current as any
        if (viewer && viewer.scene) {
          viewer.scene.add(marker)
          console.log('Marker added to scene at position:', worldPosition)
          return marker
        }
      } catch (error) {
        console.error('Error adding marker to scene:', error)
      }

      return null
    },
    [dxfViewerRef]
  )

  // Function to convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      if (!dxfViewerRef?.current) return null

      try {
        const viewer = dxfViewerRef.current as any
        if (!viewer || !viewer.camera || !viewer.renderer) {
          console.warn('DXF viewer camera or renderer not available')
          return null
        }

        // Get the renderer's canvas element
        const canvas = viewer.renderer.domElement
        const rect = canvas.getBoundingClientRect()

        // Convert screen coordinates to normalized device coordinates (-1 to +1)
        const mouse = new THREE.Vector2()
        mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1
        mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1

        // Create a raycaster
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, viewer.camera)

        // For 2D DXF drawings, we'll project onto a plane at z=0
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
        const intersectionPoint = new THREE.Vector3()

        if (raycaster.ray.intersectPlane(plane, intersectionPoint)) {
          return intersectionPoint
        }

        // Fallback: use the raycaster direction at a reasonable distance
        const direction = raycaster.ray.direction.clone()
        const distance = 10 // Reasonable distance for 2D view
        const fallbackPoint = raycaster.ray.origin
          .clone()
          .add(direction.multiplyScalar(distance))
        fallbackPoint.z = 0 // Force to 2D plane

        return fallbackPoint
      } catch (error) {
        console.error('Error converting screen to world coordinates:', error)
        return null
      }
    },
    [dxfViewerRef]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!buttonRef.current || disabled) return

      const rect = buttonRef.current.getBoundingClientRect()
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }

      // Set initial drag position to current button position
      const initialX = e.clientX - dragOffsetRef.current.x
      const initialY = e.clientY - dragOffsetRef.current.y
      setDragPosition({ x: initialX, y: initialY })

      setIsDragging(true)
      e.preventDefault()

      // Disable pointer events on button so the viewport can receive events during drag
      if (buttonRef.current) {
        buttonRef.current.style.pointerEvents = 'none'
      }
    },
    [disabled]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      const newX = e.clientX - dragOffsetRef.current.x
      const newY = e.clientY - dragOffsetRef.current.y

      setDragPosition({ x: newX, y: newY })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      // Re-enable pointer events after drag
      if (buttonRef.current) {
        buttonRef.current.style.pointerEvents = 'auto'
      }

      setIsDragging(false)

      // Convert screen coordinates to world coordinates
      const worldPosition = screenToWorld(e.clientX, e.clientY)

      if (worldPosition) {
        // Create a marker mesh at the world position
        const marker = createMarkerMesh(worldPosition)

        if (marker) {
          console.log('DXF marker created at world position:', worldPosition)
          console.log('Screen coordinates:', { x: e.clientX, y: e.clientY })
        }
      }

      // Call onDrop with the screen coordinates
      if (onDrop) {
        onDrop({
          x: e.clientX,
          y: e.clientY,
        })
      }
    },
    [isDragging, onDrop, screenToWorld, createMarkerMesh]
  )

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const buttonStyle = isDragging
    ? {
        position: 'fixed' as const,
        left: dragPosition.x,
        top: dragPosition.y,
        zIndex: 1000,
        opacity: 0.8,
        pointerEvents: 'none' as const,
      }
    : {}

  return (
    <button
      ref={buttonRef}
      className={`fixed top-48 right-8 w-[50px] h-[50px] rounded-full bg-primary border-none text-white transition-all duration-200 ease-in-out flex items-center justify-center z-[100] shadow-[0_4px_16px_rgba(56,112,213,0.3),0_2px_8px_rgba(0,0,0,0.1)] ${
        isDragging
          ? 'opacity-80 cursor-grabbing'
          : disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-grab hover:bg-primary/90'
      }`}
      style={buttonStyle}
      onMouseDown={handleMouseDown}
      disabled={disabled}
      title="Drag and drop to create markers on the DXF drawing"
    >
      <span
        className="material-icons text-[28px]"
        style={{
          fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        }}
      >
        note_add
      </span>
    </button>
  )
}
