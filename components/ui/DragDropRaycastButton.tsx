import React, { useState, useRef, useCallback, useEffect } from 'react'
import clsx from 'clsx'
import {
  RaycastUtils,
  RaycastResult,
  World,
  FragmentsManager,
} from '@/utils/raycastUtils'

interface DragDropRaycastButtonProps {
  onRaycast?: (
    result: RaycastResult | null,
    position: { x: number; y: number }
  ) => void
  worldRef: React.RefObject<World | null>
  fragmentsRef: React.RefObject<FragmentsManager | null>
}

export function DragDropRaycastButton({
  onRaycast,
  worldRef,
  fragmentsRef,
}: DragDropRaycastButtonProps) {
  const [isDragging, setIsDragging] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const getEventCoords = useCallback(
    (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) {
        // changedTouches for touchend, touches for others
        const touch =
          'changedTouches' in e && e.changedTouches.length > 0
            ? e.changedTouches[0]
            : e.touches[0]
        return { x: touch.clientX, y: touch.clientY }
      }
      return { x: e.clientX, y: e.clientY }
    },
    []
  )

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!buttonRef.current) return

      const coords = getEventCoords(e)
      const rect = buttonRef.current.getBoundingClientRect()
      dragOffsetRef.current = {
        x: coords.x - rect.left,
        y: coords.y - rect.top,
      }

      setIsDragging(true)
      e.preventDefault()

      if (buttonRef.current) {
        buttonRef.current.style.pointerEvents = 'none'
      }
    },
    [getEventCoords]
  )

  const handleDragMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!buttonRef.current) return

      e.preventDefault()

      const coords = getEventCoords(e)
      const newX = coords.x - dragOffsetRef.current.x
      const newY = coords.y - dragOffsetRef.current.y

      buttonRef.current.style.left = `${newX}px`
      buttonRef.current.style.top = `${newY}px`
    },
    [getEventCoords]
  )

  const handleDragEnd = useCallback(
    async (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return

      e.preventDefault()

      if (buttonRef.current) {
        buttonRef.current.style.pointerEvents = 'auto'
        buttonRef.current.style.left = ''
        buttonRef.current.style.top = ''
      }

      setIsDragging(false)

      const coords = getEventCoords(e)

      const raycastEntry = await RaycastUtils.performRaycastFromRefs(
        coords.x,
        coords.y,
        worldRef,
        fragmentsRef
      )

      if (raycastEntry) {
        const { result } = raycastEntry
        onRaycast?.(result, coords)
      } else {
        onRaycast?.(null, coords)
      }
    },
    [isDragging, worldRef, fragmentsRef, onRaycast, getEventCoords]
  )

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove)
      document.addEventListener('mouseup', handleDragEnd)
      document.addEventListener('touchmove', handleDragMove, {
        passive: false,
      })
      document.addEventListener('touchend', handleDragEnd)

      return () => {
        document.removeEventListener('mousemove', handleDragMove)
        document.removeEventListener('mouseup', handleDragEnd)
        document.removeEventListener('touchmove', handleDragMove)
        document.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  return (
    <button
      ref={buttonRef}
      className={clsx(
        'fixed top-48 right-4 w-[50px] h-[50px] rounded-full bg-primary border-none text-white shadow-[0_4px_16px_rgba(56,112,213,0.3),0_2px_8px_rgba(0,0,0,0.1)] flex items-center justify-center z-[100]',
        isDragging ? 'cursor-grabbing opacity-80' : 'cursor-grab'
      )}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      <span className="material-icons text-[28px]">note_add</span>
    </button>
  )
}
