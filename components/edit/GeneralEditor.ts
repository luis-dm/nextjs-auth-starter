export type TableData = {
  Name: string
  Value?: string | number | boolean
  LocalId: number
  ParentLocalId?: number
  ParentName?: string
  Type?: 'relation' | 'related'
}

export type TableNode = {
  data: TableData
  children?: TableNode[]
}

export class GeneralEditor {
  readonly onUpdated: any
  readonly sampleMaterialsUpdated: any
  readonly onPropertiesUpdated: any

  private _world: any
  private _element: any = null
  private _mesh: any = null
  private _gControls: any
  private _lControls: any[] = []
  private _controlType: 'global' | 'local' = 'global'
  private _materials: Map<number, any> | null = null
  private _localTransformsIds: number[] = []
  private _geometriesIds: number[] = []

  // Property editing properties
  private _itemsDataById = new Map<number, any>()
  private _updatedItems = new Set<number>()
  private _elementConfig: any = {
    data: {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        DefinesOcurrence: { attributes: false, relations: false },
      },
    },
  }

  // Dependencies injected through constructor
  private OBC: any
  private THREE: any
  private FRAGS: any
  private TransformControls: any
  private fragments: any
  private model: any

  get materials() {
    if (!this._materials) {
      throw new Error('Materials not initialized')
    }
    return this._materials
  }

  get localTransformsIds() {
    if (!this._localTransformsIds.length) {
      throw new Error('Local transforms not initialized')
    }
    return this._localTransformsIds
  }

  get geometriesIds() {
    if (!this._geometriesIds.length) {
      throw new Error('Geometries not initialized')
    }
    return this._geometriesIds
  }

  get samples() {
    if (!this._element) {
      throw new Error('No element selected')
    }
    return this._element.core.samples
  }

  get elementSelected() {
    return this._element !== null
  }

  constructor(dependencies: {
    world: any
    OBC: any
    THREE: any
    FRAGS: any
    TransformControls: any
    fragments: any
    model: any
  }) {
    // Assign dependencies first
    this._world = dependencies.world
    this.OBC = dependencies.OBC
    this.THREE = dependencies.THREE
    this.FRAGS = dependencies.FRAGS
    this.TransformControls = dependencies.TransformControls
    this.fragments = dependencies.fragments
    this.model = dependencies.model

    // Initialize events after OBC is available
    this.onUpdated = new this.OBC.Event()
    this.sampleMaterialsUpdated = new this.OBC.Event()
    this.onPropertiesUpdated = new this.OBC.Event()

    // Initialize controls
    this._gControls = new this.TransformControls(
      dependencies.world.camera.three,
      dependencies.world.renderer!.three.domElement!
    )

    // Setup events after all dependencies are set
    this.setupEvents()
  }

  async init() {
    this._materials = await this.model.getMaterials()
    const allLtIds = await this.model.getLocalTransformsIds()
    const allGeomsIds = await this.model.getRepresentationsIds()
    this._localTransformsIds = [allLtIds[0], allLtIds[1]]
    this._geometriesIds = [allGeomsIds[0], allGeomsIds[1]]
  }

  get3dMaterials() {
    if (!this._mesh) {
      throw new Error('No mesh selected')
    }
    const materialList = new Map<string, any>()

    this._mesh.traverse((object: any) => {
      if (object.isMesh && object.material) {
        const material = object.material
        const id = material.userData?.localId || material.uuid
        materialList.set(id, material)
      }
    })

    return Array.from(materialList.values())
  }

  async setSampleMaterial(id: number, material: number) {
    if (!this._element) {
      throw new Error('No element selected')
    }
    this._element.core.samples[id].material = material
    await this.updateSamples()
    this.sampleMaterialsUpdated.trigger()
  }

  async updateMaterials() {
    if (!this._materials) {
      throw new Error('Materials not initialized')
    }
    this._materials = await this.model.getMaterials()
  }

  overrideGeometryWithCube() {
    if (!this._mesh) {
      throw new Error('No mesh selected')
    }
    this._mesh.traverse((object: any) => {
      if (object.isMesh) {
        object.geometry.dispose()
        object.geometry = new this.THREE.BoxGeometry()
      }
    })
  }

  async applyChanges() {
    if (!this._element || !this._mesh) {
      throw new Error('No element or mesh selected')
    }

    await this._element.setMeshes(this._mesh)
    this.dispose()

    const requests = this._element.getRequests()
    if (requests) {
      await this.fragments.editor.edit(this.model.modelId, requests)
    }

    if (!this._element.elementChanged) {
      const promises: Promise<void>[] = []
      for (const [, model] of this.fragments.models.list) {
        promises.push(model.setVisible([this._element.localId], true))
      }
      await Promise.all(promises)
    }

    await this.fragments.update(true)

    this._element = null
    this._mesh = null

    this.onUpdated.trigger()
  }

  async cloneElement() {
    if (!this._element || !this._mesh) {
      throw new Error('No element or mesh selected')
    }

    try {
      console.log('Starting element clone process...')

      // Get the original element data
      const originalData = await this._element.getData()
      if (!originalData) {
        throw new Error('Could not retrieve element data')
      }

      // Generate a new unique local ID
      const newLocalId = Date.now()
      console.log('Generated new local ID:', newLocalId)

      // Clone the element data and modify it for the new element
      const clonedData = JSON.parse(JSON.stringify(originalData))

      // Update name to indicate it's a copy
      if (clonedData.Name?.value) {
        clonedData.Name.value += ' (Copy)'
      } else if (clonedData.name?.value) {
        clonedData.name.value += ' (Copy)'
      }

      // Define edit requests array like in the examples
      const requests: any[] = []

      // Use temp IDs like in the examples
      const tempItemId = `new-item-${newLocalId}`
      const tempGlobalTransformId = `new-global-transform-${newLocalId}`

      // Create the new item request
      requests.push({
        type: this.FRAGS.EditRequestType.CREATE_ITEM,
        tempId: tempItemId,
        data: {
          data: clonedData.data || clonedData,
          category:
            clonedData.category ||
            clonedData._category?.value ||
            'IFCBUILDINGELEMENTPROXY',
          guid: crypto.randomUUID ? crypto.randomUUID() : `clone-${newLocalId}`,
        },
      })

      // Create a global transform for the cloned element with offset
      const offset = 2

      // Get the original element's core for accessing transforms and samples
      const originalCore = this._element.core

      // Get the original element's global transform to maintain orientation
      const originalGlobalTransformId = this._element.getGlobalTransformId()
      let originalTransform = {
        position: [0, 0, 0],
        xDirection: [1, 0, 0],
        yDirection: [0, 1, 0],
      }

      if (
        originalGlobalTransformId &&
        originalCore.globalTransforms[originalGlobalTransformId]
      ) {
        originalTransform =
          originalCore.globalTransforms[originalGlobalTransformId]
        console.log('Using original transform:', originalTransform)
      }

      requests.push({
        type: this.FRAGS.EditRequestType.CREATE_GLOBAL_TRANSFORM,
        tempId: tempGlobalTransformId,
        data: {
          position: [
            originalTransform.position[0] + offset,
            originalTransform.position[1],
            originalTransform.position[2],
          ],
          xDirection: originalTransform.xDirection,
          yDirection: originalTransform.yDirection,
          itemId: tempItemId,
        },
      })

      // Get the original element's samples and clone them
      if (originalCore.samples) {
        const sampleIds = Object.keys(originalCore.samples)
        console.log('Original sample IDs:', sampleIds)

        for (const sampleId of sampleIds) {
          const originalSample = originalCore.samples[parseInt(sampleId)]
          if (originalSample) {
            console.log('Cloning sample:', originalSample)

            // Create new sample using the temp global transform ID pattern
            requests.push({
              type: this.FRAGS.EditRequestType.CREATE_SAMPLE,
              data: {
                item: tempGlobalTransformId, // Reference the temp global transform ID
                material: originalSample.material,
                representation: originalSample.representation,
                localTransform: originalSample.localTransform,
              },
            })
          }
        }
      } else {
        console.warn('No samples found in original element')
      }

      // Apply all the edit requests to the model
      console.log('Applying edit requests:', requests)
      const editedIds = await this.fragments.editor.edit(
        this.model.modelId,
        requests
      )
      console.log('Applied changes, edited IDs:', editedIds)

      // Update the fragments
      await this.fragments.update(true)

      // Force a re-render
      this._world.renderer?.update()

      console.log(`Element cloned successfully!`)
      this.onUpdated.trigger()

      return newLocalId
    } catch (error) {
      console.error('Error cloning element:', error)

      // Simple fallback: just create a visual mesh clone
      console.log('Attempting fallback mesh clone...')
      try {
        const clonedMesh = this._mesh.clone()
        const offset = 2

        // Deep clone geometry and materials
        clonedMesh.traverse((child: any) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry = child.geometry.clone()
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map((mat: any) => mat.clone())
              } else {
                child.material = child.material.clone()
              }
            }
          }
        })

        clonedMesh.position.copy(this._mesh.position)
        clonedMesh.position.x += offset
        clonedMesh.position.z += offset

        this._world.scene.three.add(clonedMesh)
        this._world.renderer?.update()

        console.log('Fallback mesh clone created (visual only)')
        this.onUpdated.trigger()

        return Date.now()
      } catch (fallbackError) {
        console.error('Fallback cloning also failed:', fallbackError)
        throw fallbackError
      }
    }
  }

  async deleteElement() {
    if (!this._element || !this._mesh) {
      throw new Error('No element or mesh selected')
    }

    try {
      console.log('Starting element delete process...')

      // Define edit requests array
      const requests: any[] = []

      // Get the current element's local ID
      const elementLocalId = this._element.localId
      console.log('Deleting element with local ID:', elementLocalId)

      // Get all items in the model to find another item to transfer global transforms to
      const items = await this.model.getItems()
      const itemIds = Array.from(items.keys())
      console.log('Available item IDs:', itemIds)

      // Find another item that's not the one we're deleting
      const otherItemId = itemIds.find((id) => id !== elementLocalId)

      if (!otherItemId) {
        console.warn('No other items found to transfer global transforms to')
      }

      // Get global transform IDs associated with the item we're deleting
      const gtIds = await this.model.getGlobalTranformsIdsOfItems([
        elementLocalId,
      ])
      console.log('Global transform IDs to handle:', gtIds)

      // Create delete request for the item
      requests.push({
        type: this.FRAGS.EditRequestType.DELETE_ITEM,
        localId: elementLocalId,
      })

      // If we have other items and global transforms, transfer them
      if (otherItemId && gtIds.length > 0) {
        const gts = await this.model.getGlobalTransforms(gtIds)
        for (const [id, gt] of gts) {
          requests.push({
            type: this.FRAGS.EditRequestType.UPDATE_GLOBAL_TRANSFORM,
            localId: id,
            data: { ...gt, itemId: otherItemId },
          })
        }
        console.log('Transferring global transforms to item:', otherItemId)
      } else if (gtIds.length > 0) {
        // If no other items exist, we might need to delete the global transforms too
        for (const gtId of gtIds) {
          requests.push({
            type: this.FRAGS.EditRequestType.DELETE_GLOBAL_TRANSFORM,
            localId: gtId,
          })
        }
        console.log('Deleting orphaned global transforms')
      }

      // Apply all the edit requests to the model
      console.log('Applying delete requests:', requests)
      const editedIds = await this.fragments.editor.edit(
        this.model.modelId,
        requests
      )
      console.log('Applied delete requests, edited IDs:', editedIds)

      // Apply and save the changes to make them persistent
      await this.fragments.editor.applyChanges(this.model.modelId)
      console.log('Applied changes to model for persistence')

      // Save the changes to the model to make them permanent
      await this.fragments.editor.save(this.model.modelId)
      console.log('Saved model with deleted element')

      // Clean up the editor state
      this.dispose()
      this._element = null
      this._mesh = null

      // Update the fragments
      await this.fragments.update(true)

      // Force a re-render
      this._world.renderer?.update()

      console.log('Element deleted successfully!')
      this.onUpdated.trigger()
      this.onPropertiesUpdated.trigger([]) // Clear properties table
    } catch (error) {
      console.error('Error deleting element:', error)
      throw error
    }
  }

  async updatePropertiesTable() {
    if (!this._element) {
      this.onPropertiesUpdated.trigger([])
      return
    }
    this._itemsDataById.clear()
    this._updatedItems.clear()

    // Set the element config for proper data retrieval
    this._element.config = this._elementConfig
    const data = await this._element.getData()
    const rootNode = this.getTableRecursively(data)
    this.onPropertiesUpdated.trigger([rootNode])
  }

  async applyPropertyChanges() {
    if (!this._element) return

    try {
      for (const localId of this._updatedItems) {
        const item = this._itemsDataById.get(localId)
        if (item) {
          await this.fragments.editor.setItem(this.model.modelId, item)
        }
      }

      await this.fragments.editor.applyChanges(this.model.modelId)
      await this.updatePropertiesTable()
      await this.fragments.update(true)

      console.log('Property changes applied successfully')
    } catch (error) {
      console.error('Error applying property changes:', error)
    }
  }

  private getTableRecursively(data: any, parent?: TableNode): TableNode {
    // Get the local ID from the data
    const localId = data._localId?.value || data.localId || 0
    this._itemsDataById.set(localId, data)

    const nodeData: TableData = {
      Name: localId.toString(),
      Value: localId.toString(),
      LocalId: localId,
      ParentLocalId: parent?.data.LocalId,
      ParentName: parent?.data.Name,
      Type: 'related', // All element nodes should be 'related' type
    }

    const node: TableNode = { data: nodeData, children: [] }

    // Process attributes
    for (const [attrName, attrValue] of Object.entries(data)) {
      if (attrName.startsWith('_') || attrName === 'localId') continue

      if (Array.isArray(attrValue)) {
        // This is a relation
        const relationData: TableData = {
          Name: attrName,
          Value: `${attrValue.length} items`,
          LocalId: localId,
          ParentLocalId: localId,
          ParentName: nodeData.Name,
          Type: 'relation',
        }
        const relationNode: TableNode = {
          data: relationData,
          children: [],
        }

        attrValue.forEach((item: any) => {
          const childNode = this.getTableRecursively(item, relationNode)
          relationNode.children!.push(childNode)
        })

        node.children!.push(relationNode)
      } else if (
        attrValue &&
        typeof attrValue === 'object' &&
        'value' in attrValue
      ) {
        // This is a regular attribute with value
        if (attrValue.value !== undefined && attrValue.value !== null) {
          const attrData: TableData = {
            Name: attrName,
            Value: (attrValue as any).value,
            LocalId: localId,
            ParentLocalId: localId,
            ParentName: nodeData.Name,
          }
          node.children!.push({ data: attrData })
        }
      }
    }

    return node
  }

  setControlsMode(mode: 'translate' | 'rotate') {
    this._gControls.setMode(mode)
    for (const localTransformControl of this._lControls) {
      localTransformControl.setMode(mode)
    }
  }

  setControlsTarget(target = this._controlType) {
    const globalGizmo = this._gControls.getHelper()
    if (target === 'global') {
      this._world.scene.three.add(globalGizmo)
      for (const localTransformControl of this._lControls) {
        const localGizmo = localTransformControl.getHelper()
        localGizmo.removeFromParent()
      }
    } else {
      globalGizmo.removeFromParent()
      for (const localTransformControl of this._lControls) {
        const localGizmo = localTransformControl.getHelper()
        this._world.scene.three.add(localGizmo)
      }
    }
    this._controlType = target
  }

  async updateSamples() {
    if (!this._element || !this._mesh) {
      throw new Error('No element or mesh selected')
    }
    const prevTransform = this._mesh.matrixWorld.clone()
    await this._element.updateSamples()
    this.dispose()

    this._mesh = await this._element.getMeshes()
    this._world.scene.three.add(this._mesh)
    await this.createControls()
    this._mesh.position.set(0, 0, 0)
    this._mesh.rotation.set(0, 0, 0)
    this._mesh.applyMatrix4(prevTransform)
  }

  private async createControls() {
    if (!this._mesh) {
      throw new Error('No mesh available')
    }

    this._gControls.attach(this._mesh)

    for (const localMesh of this._mesh.children) {
      const localTransformControl = new this.TransformControls(
        this._world.camera.three,
        this._world.renderer!.three.domElement!
      )
      localTransformControl.attach(localMesh)
      this._lControls.push(localTransformControl)
    }

    this.setControlsTarget()
  }

  private dispose() {
    if (this._mesh && this._element) {
      this._mesh.removeFromParent()
    }

    const globalGizmo = this._gControls.getHelper()
    globalGizmo.removeFromParent()
    this._gControls.detach()

    if (!this._mesh || !this._element) {
      return
    }

    for (const localTransformControl of this._lControls) {
      const localGizmo = localTransformControl.getHelper()
      localGizmo.removeFromParent()
    }
    this._lControls.length = 0
  }

  private async setVisible(visible: boolean) {
    if (!this._element) {
      return
    }

    const promises: Promise<void>[] = []
    for (const [, model] of this.fragments.models.list) {
      if (model.deltaModelId) {
        if (visible === true) {
          const editedElements = new Set(await model.getEditedElements())
          if (visible && editedElements.has(this._element.localId)) {
            continue
          }
        }
      }

      promises.push(model.setVisible([this._element.localId], visible))
    }
    await Promise.all(promises)
  }

  private setupEvents() {
    // Prevent camera move when using the global transform controls
    this._gControls.addEventListener('dragging-changed', (event: any) => {
      if (this._world.camera.hasCameraControls()) {
        this._world.camera.controls.enabled = !event.value
      }
    })

    // Double click event logic to select an element
    const mouse = new this.THREE.Vector2()
    const canvas = this._world.renderer!.three.domElement!
    canvas.addEventListener('dblclick', async (event: MouseEvent) => {
      mouse.x = event.clientX
      mouse.y = event.clientY
      let result: any

      // Raycast all models, including delta models
      for (const [, model] of this.fragments.models.list) {
        const promises: Promise<any>[] = []
        promises.push(
          model.raycast({
            camera: this._world.camera.three,
            mouse,
            dom: this._world.renderer!.three.domElement!,
          })
        )
        const results = await Promise.all(promises)
        let smallestDistance = Infinity
        for (const current of results) {
          if (current) {
            if (current.distance < smallestDistance) {
              smallestDistance = current.distance
              result = current
            }
          }
        }
      }

      // If nothing is found, return
      if (!result) {
        return
      }

      // If an element was already selected, reset the visibility
      if (this._element) {
        await this.setVisible(true)
      }

      // Get the selected element
      const [element] = await this.fragments.editor.getElements(
        this.model.modelId,
        [result.localId]
      )
      this._element = element
      if (!element) {
        return
      }

      // Dispose the previous mesh, if any
      if (this._mesh) {
        this.dispose()
      }

      // Set the visibility of the selected elements to false in the original model
      await this.setVisible(false)

      // Add the selected meshes to the scene and add the transform controls
      this._mesh = await element.getMeshes()
      this._world.scene.three.add(this._mesh)
      await this.createControls()

      // Update the viewer to see the changes
      await this.fragments.update(true)

      // Trigger the UI update
      this.onUpdated.trigger()
      this.sampleMaterialsUpdated.trigger()

      // Update properties table for the selected element
      await this.updatePropertiesTable()
    })

    // Keydown event logic to cancel the edit when pressing the escape key
    window.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') {
        if (!this._element || !this._mesh) {
          return
        }

        // Clear the existing edit requests
        this._element.getRequests()
        this.dispose()

        // All canceled: show hidden items
        this.setVisible(true)

        // Update the viewer to see the changes
        await this.fragments.update(true)

        // Reset the element and mesh variables
        this._element = null
        this._mesh = null

        // Trigger the UI update
        this.onUpdated.trigger()
        this.sampleMaterialsUpdated.trigger()

        // Clear properties table
        this.onPropertiesUpdated.trigger([])
      }
    })
  }

  updateAttribute(row: Partial<TableData>, event: any) {
    try {
      if (!this._element || !row.LocalId || !row.Name) {
        console.error('Invalid element or row data')
        return
      }

      const localId = row.LocalId as number
      const item = this._itemsDataById.get(localId)
      if (!item) {
        console.error(`Item ${localId} not found`)
        return
      }

      // Get the attribute from the item data
      const attr = item[row.Name] as any
      if (!attr) {
        console.error(`Attribute ${row.Name} not found in item`)
        return
      }

      // Update the value based on the attribute structure
      if (typeof attr === 'object' && attr !== null && 'value' in attr) {
        attr.value = event.target.value
      } else {
        item[row.Name] = event.target.value
      }

      // Mark this item as updated
      this._updatedItems.add(localId)
      console.log(`Updated ${row.Name} to:`, event.target.value)
    } catch (error) {
      console.error('Error updating attribute:', error)
    }
  }

  // We'll use this when the user clicks the "Delete attribute" button in the UI
  // to remove the attribute from the current list of attributes
  async deleteAttribute(localId: number, attributeName: string) {
    try {
      if (!this._element) {
        console.error('No element selected')
        return
      }

      // If it's an element deletion (not attribute)
      if (attributeName === 'element') {
        await this.fragments.editor.deleteData(this.model.modelId, {
          itemIds: [localId],
        })
        await this.fragments.editor.applyChanges(this.model.modelId)
        await this.updatePropertiesTable()
        console.log(`Deleted element ${localId}`)
        return
      }

      // For regular attribute deletion
      const item = this._itemsDataById.get(localId)
      if (!item) {
        console.error(`Item ${localId} not found`)
        return
      }

      // Remove the attribute from the item
      delete item[attributeName]

      // Mark this item as updated
      this._updatedItems.add(localId)

      // Refresh the properties table
      await this.updatePropertiesTable()

      console.log(`Deleted attribute ${attributeName} from item ${localId}`)
    } catch (error) {
      console.error('Error deleting attribute:', error)
    }
  }
}
