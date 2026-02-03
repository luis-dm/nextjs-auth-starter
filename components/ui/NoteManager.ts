import * as THREE from 'three'
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { RaycastUtils, World, FragmentsManager } from '@/utils/raycastUtils'
import { NoteData, NoteFormData } from '@/types/note'

export class NoteManager {
  private world: World
  private markers: NoteData[] = []
  private onCountChange?: (count: number) => void
  private listeners: Set<(count: number) => void> = new Set()
  private css2DRenderer: CSS2DRenderer | null = null
  private pendingMarker: {
    position: THREE.Vector3
    screenPosition: { x: number; y: number }
    attachedLocalId?: number
  } | null = null
  private onShowForm?: (
    position: THREE.Vector3,
    screenPosition: { x: number; y: number }
  ) => void
  private onEditNote?: (noteData: NoteData) => void
  private onCameraLookAt?: (noteData: NoteData) => void
  private onNoteClick?: (noteData: NoteData) => void
  private onSelectElement?: (localId: number) => void
  private isDragging = false
  private dragMarker: NoteData | null = null
  private fragmentsRef: FragmentsManager | null = null

  constructor(
    world: World,
    onCountChange?: (count: number) => void,
    onShowForm?: (
      position: THREE.Vector3,
      screenPosition: { x: number; y: number }
    ) => void,
    onEditNote?: (noteData: NoteData) => void,
    onCameraLookAt?: (noteData: NoteData) => void,
    onNoteClick?: (noteData: NoteData) => void,
    onSelectElement?: (localId: number) => void,
    fragmentsRef?: FragmentsManager
  ) {
    this.world = world
    this.onCountChange = onCountChange
    this.onShowForm = onShowForm
    this.onEditNote = onEditNote
    this.onCameraLookAt = onCameraLookAt
    this.onNoteClick = onNoteClick
    this.onSelectElement = onSelectElement
    this.fragmentsRef = fragmentsRef || null
    this.setupCSS2DRenderer()
  }

  private generateUUID(): string {
    // Fallback UUID generation for environments where crypto.randomUUID is not available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }

    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0
        const v = c == 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
      }
    )
  }

  private setupCSS2DRenderer() {
    if (!this.world?.renderer?.three?.domElement) return

    // Create CSS2D renderer for 2D overlays
    this.css2DRenderer = new CSS2DRenderer()
    const canvas = this.world.renderer.three.domElement
    const container = canvas.parentElement

    if (container) {
      this.css2DRenderer.setSize(container.clientWidth, container.clientHeight)
      this.css2DRenderer.domElement.style.position = 'absolute'
      this.css2DRenderer.domElement.style.top = '0'
      this.css2DRenderer.domElement.style.left = '0'
      this.css2DRenderer.domElement.style.pointerEvents = 'none'
      container.appendChild(this.css2DRenderer.domElement)

      // Set up render loop integration only if render method exists
      const originalRender = this.world.renderer.three.render
      if (originalRender) {
        const boundRender = originalRender.bind(this.world.renderer.three)
        this.world.renderer.three.render = (
          scene: THREE.Scene,
          camera: THREE.Camera
        ) => {
          boundRender(scene, camera)
          if (this.css2DRenderer) {
            this.css2DRenderer.render(scene, camera)
          }
        }
      }
    }
  }

  private createMarkerElement(
    id: string,
    title: string,
    markerData?: NoteData
  ): HTMLDivElement {
    const markerDiv = document.createElement('div')

    // Apply Tailwind classes directly to the element
    markerDiv.className =
      'flex items-center justify-center gap-2 bg-white px-1 py-0.5 border-2 border-primary rounded-[30px] shadow-lg font-sans text-sm font-medium text-gray-800 pointer-events-auto cursor-pointer transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-xl'

    // Create note icon using Material Icons
    const iconElement = document.createElement('span')
    iconElement.className = 'material-icons'
    iconElement.textContent = 'article'
    iconElement.style.fontSize = '20px'
    iconElement.style.color = 'white'
    iconElement.style.backgroundColor = '#3870d5'
    iconElement.style.borderRadius = '50%'
    iconElement.style.width = '28px'
    iconElement.style.height = '28px'
    iconElement.style.display = 'flex'
    iconElement.style.alignItems = 'center'
    iconElement.style.justifyContent = 'center'

    // Create title
    const titleElement = document.createElement('span')
    const cleanTitle = title.trim() // Remove any extra whitespace
    const truncatedTitle =
      cleanTitle.length > 25 ? cleanTitle.substring(0, 25) + '...' : cleanTitle
    titleElement.textContent = truncatedTitle
    titleElement.className = 'whitespace-nowrap'

    // Add hover functionality to show full title if truncated
    if (cleanTitle.length > 25) {
      markerDiv.addEventListener('mouseenter', () => {
        titleElement.textContent = cleanTitle
      })

      markerDiv.addEventListener('mouseleave', () => {
        titleElement.textContent = truncatedTitle
      })
    }

    // Add drag functionality when unlocked
    this.setupMarkerDrag(markerDiv, markerData)

    // Add click functionality to open note details
    markerDiv.addEventListener('pointerdown', (e) => {
      // For locked notes or right clicks, open immediately
      if (markerData?.isLocked !== false || e.button !== 0) {
        e.preventDefault()
        e.stopPropagation()
        if (markerData) {
          if (this.onNoteClick) {
            this.onNoteClick(markerData)
          }
          // Select the element if we have a localId
          if (
            markerData.attachedLocalId !== undefined &&
            this.onSelectElement
          ) {
            this.onSelectElement(markerData.attachedLocalId)
          }
          // Position camera to look at the note
          if (this.onCameraLookAt) {
            this.onCameraLookAt(markerData)
          }
          // Open note for editing
          if (this.onEditNote) {
            this.onEditNote(markerData)
          }
        }
      }
      // For unlocked notes with left click, the drag handler will manage click vs drag
    })

    // Make marker clickable
    markerDiv.style.cursor = markerData?.isLocked === false ? 'grab' : 'pointer'
    markerDiv.style.pointerEvents = 'all'

    markerDiv.appendChild(iconElement)
    markerDiv.appendChild(titleElement)

    return markerDiv
  }

  private setupMarkerDrag(markerDiv: HTMLDivElement, markerData?: NoteData) {
    if (!markerData) return

    let dragStartTime = 0
    let dragStartPos = { x: 0, y: 0 }

    const handleMouseDown = (e: MouseEvent) => {
      // Only handle unlocked notes with left mouse button
      if (markerData.isLocked !== false || e.button !== 0) return

      this.isDragging = true
      this.dragMarker = markerData
      dragStartTime = Date.now()
      dragStartPos = { x: e.clientX, y: e.clientY }

      markerDiv.style.zIndex = '1000'
      markerDiv.style.opacity = '0.8'
      markerDiv.style.cursor = 'grabbing' // Change to grabbing cursor during drag
      markerDiv.style.pointerEvents = 'none' // Prevent hover effects during drag

      e.preventDefault()
      e.stopPropagation()
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (this.dragMarker !== markerData) return

      // Create a temporary 3D position based on cursor position for visual feedback
      if (
        this.world?.camera?.three &&
        this.world?.renderer?.three?.domElement
      ) {
        const canvas = this.world.renderer.three.domElement
        const rect = canvas.getBoundingClientRect()

        // Convert screen coordinates to normalized coordinates
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        )

        // Create a raycaster to project the cursor into 3D space
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, this.world.camera.three)

        // Project to a plane at the marker's current distance from camera
        const cameraPos = this.world.camera.three.position
        const markerPos = markerData.position
        const distance = cameraPos.distanceTo(markerPos)

        // Get a point along the ray at the same distance
        const direction = raycaster.ray.direction.clone()
        const tempPos = raycaster.ray.origin
          .clone()
          .add(direction.multiplyScalar(distance))

        // Update marker position temporarily for visual feedback
        markerData.object3D.position.copy(tempPos)
      }
    }

    const handleMouseUp = async (e: MouseEvent) => {
      if (this.dragMarker !== markerData) return

      const endTime = Date.now()
      const endPos = { x: e.clientX, y: e.clientY }
      const distance = Math.sqrt(
        Math.pow(endPos.x - dragStartPos.x, 2) +
          Math.pow(endPos.y - dragStartPos.y, 2)
      )

      this.isDragging = false
      this.dragMarker = null

      markerDiv.style.zIndex = ''
      markerDiv.style.opacity = ''
      markerDiv.style.cursor = 'grab' // Reset to grab cursor after drag
      markerDiv.style.pointerEvents = 'all'

      // If it was a quick click without much movement, open the note
      if (endTime - dragStartTime < 200 && distance < 5) {
        if (this.onNoteClick) {
          this.onNoteClick(markerData)
        }
        // Select the element if we have a localId
        if (markerData.attachedLocalId !== undefined && this.onSelectElement) {
          this.onSelectElement(markerData.attachedLocalId)
        }
        // Position camera to look at the note
        if (this.onCameraLookAt) {
          this.onCameraLookAt(markerData)
        }
        // Open note for editing
        if (this.onEditNote) {
          this.onEditNote(markerData)
        }
        return
      }

      // Perform raycast to find new position using the same method as DragDropRaycastButton
      const raycastResult = await this.performRaycastForDrag(
        e.clientX,
        e.clientY
      )

      if (raycastResult) {
        // Update marker position
        markerData.position.copy(raycastResult.point)
        markerData.object3D.position.copy(raycastResult.point)
        markerData.lastUpdated = new Date()

        // Update attached localId if available
        if (raycastResult.localId !== undefined) {
          markerData.attachedLocalId = raycastResult.localId
        }

        console.log(`Repositioned note ${markerData.id} to:`, {
          position: {
            x: raycastResult.point.x.toFixed(2),
            y: raycastResult.point.y.toFixed(2),
            z: raycastResult.point.z.toFixed(2),
          },
          attachedLocalId: raycastResult.localId,
        })
      } else {
        // Reset to original position if no valid intersection found
        markerData.object3D.position.copy(markerData.position)
        console.log(
          `Failed to reposition note ${markerData.id} - no valid intersection found`
        )
      }
    }

    markerDiv.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  private async performRaycastForDrag(
    clientX: number,
    clientY: number
  ): Promise<{ point: THREE.Vector3; localId?: number } | null> {
    if (
      !this.world?.camera?.three ||
      !this.world?.renderer?.three?.domElement ||
      !this.fragmentsRef
    ) {
      return null
    }

    const raycastEntry = await RaycastUtils.performRaycast(
      clientX,
      clientY,
      this.world.camera.three,
      this.world.renderer.three.domElement,
      this.fragmentsRef as Parameters<typeof RaycastUtils.performRaycast>[4]
    )

    if (raycastEntry) {
      const { result } = raycastEntry
      console.log('Raycast hit from model during drag:', result)
      return {
        point: result.point,
        localId: result.localId,
      }
    } else {
      console.log('No raycast hits found during drag')
      return null
    }
  }

  addCountListener(listener: (count: number) => void) {
    this.listeners.add(listener)
  }

  removeCountListener(listener: (count: number) => void) {
    this.listeners.delete(listener)
  }

  private notifyCountChange() {
    const count = this.markers.length
    this.onCountChange?.(count)
    this.listeners.forEach((listener) => listener(count))
  }

  createNote(
    position: THREE.Vector3,
    screenPosition?: { x: number; y: number },
    localId?: number
  ): void {
    // Show form when marker creation is requested
    if (this.onShowForm && screenPosition) {
      this.pendingMarker = {
        position: position.clone(),
        screenPosition,
        attachedLocalId: localId,
      }
      this.onShowForm(position, screenPosition)
    } else {
      console.warn(
        'NoteManager: createNote called without onShowForm callback or screenPosition'
      )
    }
  }

  createMarkerWithData(
    position: THREE.Vector3,
    formData: NoteFormData
  ): CSS2DObject {
    // Generate UUID for unique note ID
    const id = this.generateUUID()
    const now = new Date()

    // Create initial marker data for element creation
    const initialMarkerData: NoteData = {
      object3D: null as unknown as CSS2DObject, // Will be set below
      element: null as unknown as HTMLDivElement, // Will be set below
      position: position.clone(),
      id,
      title: formData.title,
      description: formData.description,
      urls: formData.urls,
      files: formData.files,
      comments: formData.comments || [],
      customFields: formData.customFields || [],
      isLocked: formData.isLocked !== undefined ? formData.isLocked : true,
      createdAt: now,
      lastUpdated: now,
      attachedLocalId: formData.attachedLocalId,
    }

    // If no localId in form data, use pending localId
    if (
      !initialMarkerData.attachedLocalId &&
      this.pendingMarker?.attachedLocalId
    ) {
      initialMarkerData.attachedLocalId = this.pendingMarker.attachedLocalId
    }

    // Create the HTML marker element with complete marker data
    const markerElement = this.createMarkerElement(
      id,
      formData.title,
      initialMarkerData
    )

    // Create CSS2D object
    const markerObject = new CSS2DObject(markerElement)
    markerObject.position.copy(position)

    // Update marker data with actual objects
    initialMarkerData.object3D = markerObject
    initialMarkerData.element = markerElement

    // Add to scene
    if (this.world?.scene?.three) {
      this.world.scene.three.add(markerObject)
    }

    this.markers.push(initialMarkerData)

    // Notify count change
    this.notifyCountChange()

    console.log(`Created note at position:`, {
      x: position.x.toFixed(2),
      y: position.y.toFixed(2),
      z: position.z.toFixed(2),
      id,
      title: formData.title,
      attachedLocalId: initialMarkerData.attachedLocalId,
    })

    return markerObject
  }

  handleFormSubmit(
    formData: NoteFormData,
    isEditing = false,
    noteId?: string
  ): void {
    if (isEditing && noteId) {
      this.updateNote(noteId, formData)
    } else if (this.pendingMarker) {
      this.createMarkerWithData(this.pendingMarker.position, formData)
    }
  }

  cancelMarkerCreation(): void {
    this.pendingMarker = null
  }

  clearAllNotes(): void {
    this.markers.forEach((marker) => {
      if (this.world?.scene?.three) {
        this.world.scene.three.remove(marker.object3D)
      }
    })
    this.markers = []
    this.notifyCountChange()
    console.log('Cleared all notes')
  }

  getNoteCount(): number {
    return this.markers.length
  }

  // Current: get notes from local memory
  getAllNotes(): Array<Omit<NoteData, 'object3D' | 'element' | 'position'>> {
    return this.markers.map((marker) => ({
      id: marker.id,
      title: marker.title,
      description: marker.description,
      urls: marker.urls,
      files: marker.files,
      comments: marker.comments,
      customFields: marker.customFields,
      lastUpdated: marker.lastUpdated,
      createdAt: marker.createdAt,
      isLocked: marker.isLocked,
      attachedLocalId: marker.attachedLocalId,
    }))
  }

  findNoteById(noteId: string): NoteData | null {
    return this.markers.find((marker) => marker.id === noteId) || null
  }

  updateNote(noteId: string, formData: NoteFormData): void {
    const markerIndex = this.markers.findIndex((marker) => marker.id === noteId)
    if (markerIndex === -1) return

    const marker = this.markers[markerIndex]

    const preservedComments =
      formData.comments !== undefined
        ? formData.comments
        : marker.comments || []

    // Update marker data
    marker.title = formData.title
    marker.description = formData.description
    marker.urls = formData.urls
    marker.files = formData.files
    marker.comments = preservedComments
    marker.customFields = formData.customFields || []
    marker.isLocked =
      formData.isLocked !== undefined ? formData.isLocked : marker.isLocked
    marker.lastUpdated = new Date() // Update timestamp

    // Preserve or update attached localId
    if (formData.attachedLocalId !== undefined) {
      marker.attachedLocalId = formData.attachedLocalId
    }

    // Update the visual element
    const newElement = this.createMarkerElement(
      marker.id,
      marker.title, // Use the updated title from marker data
      marker
    )

    // Clear the old element's content and replace it entirely
    const oldElement = marker.object3D.element
    if (oldElement) {
      // Clear all children
      while (oldElement.firstChild) {
        oldElement.removeChild(oldElement.firstChild)
      }

      // Copy all children from new element to old element
      while (newElement.firstChild) {
        oldElement.appendChild(newElement.firstChild)
      }

      // Copy classes and attributes
      oldElement.className = newElement.className
    }

    console.log(`Updated note ${noteId}:`, {
      title: formData.title,
      commentsCount: preservedComments.length,
      position: {
        x: marker.position.x.toFixed(2),
        y: marker.position.y.toFixed(2),
        z: marker.position.z.toFixed(2),
      },
    })
  }

  dispose(): void {
    this.clearAllNotes()

    // Clean up CSS2D renderer
    if (this.css2DRenderer && this.css2DRenderer.domElement.parentElement) {
      this.css2DRenderer.domElement.parentElement.removeChild(
        this.css2DRenderer.domElement
      )
    }
    this.css2DRenderer = null
  }
}
