interface SpatialNode {
  category?: string | null
  localId?: number | null
  name?: string | null
  children?: SpatialNode[]
}

export class SpatialOptimizer {
  /**
   * create lookup-optimized structure
   */
  static createLookupOptimized(node: SpatialNode): {
    levels: Record<string, number[]>
    categories: Record<string, number[]>
    elements: Record<
      number,
      { name?: string; category?: string; level?: string }
    >
  } {
    const levels: Record<string, number[]> = {}
    const categories: Record<string, number[]> = {}
    const elements: Record<
      number,
      { name?: string; category?: string; level?: string }
    > = {}

    const traverse = (
      currentNode: SpatialNode,
      currentLevel?: string
    ): void => {
      // Check if this is a building storey/level
      if (
        currentNode.category?.includes('BUILDINGSTOREY') ||
        currentNode.category?.includes('LEVEL')
      ) {
        // Look for actual level name in children
        if (currentNode.children) {
          for (const child of currentNode.children) {
            if (child.localId && child.name) {
              currentLevel = child.name
              break
            }
          }
        }
      }

      // If this node has a localId, record it
      if (currentNode.localId) {
        elements[currentNode.localId] = {
          name: currentNode.name || undefined,
          category: currentNode.category || undefined,
          level: currentLevel || undefined,
        }

        // Add to level
        if (currentLevel) {
          if (!levels[currentLevel]) levels[currentLevel] = []
          levels[currentLevel].push(currentNode.localId)
        }

        // Add to category
        if (currentNode.category) {
          if (!categories[currentNode.category])
            categories[currentNode.category] = []
          categories[currentNode.category].push(currentNode.localId)
        }
      }

      // Traverse children
      if (currentNode.children) {
        for (const child of currentNode.children) {
          traverse(child, currentLevel)
        }
      }
    }

    traverse(node)
    return { levels, categories, elements }
  }

  /**
   * Recursively sub-chunk categories that are still too large
   */
  static subChunkByCategoriesRecursive(
    storeyChunk: {
      storeyName: string
      data: any
      size: number
    },
    maxSubChunkSize: number = 180000
  ): Array<{
    storeyName: string
    categoryName: string
    data: any
    size: number
    isDeepSubChunk?: boolean
  }> {
    console.log(
      ` Sub-chunking storey "${storeyChunk.storeyName}" (${storeyChunk.size} chars) by categories...`
    )

    const subChunks: Array<{
      storeyName: string
      categoryName: string
      data: any
      size: number
      isDeepSubChunk?: boolean
    }> = []

    // Find all category groups within this storey, preserving full node structure
    const categoryGroups = new Map<
      string,
      { nodes: any[]; fullStructure: any }
    >()

    const extractCategories = (node: any, parentStructure?: any): void => {
      if (node.category && node.category !== null && !node.localId) {
        // This is a category container node
        const categoryName = node.category

        if (!categoryGroups.has(categoryName)) {
          categoryGroups.set(categoryName, { nodes: [], fullStructure: node })
        }

        // Store the complete node structure (not just elements)
        categoryGroups.get(categoryName)!.nodes.push({
          ...node,
          parentContext: parentStructure
            ? {
                category: parentStructure.category,
                localId: parentStructure.localId,
                name: parentStructure.name,
              }
            : undefined,
        })
      }

      // Continue searching in children
      if (node.children) {
        node.children.forEach((child: any) => extractCategories(child, node))
      }
    }

    extractCategories(storeyChunk.data)

    // Create sub-chunks for each category with recursive sub-chunking if needed
    for (const [categoryName, categoryInfo] of categoryGroups) {
      // Skip IFCBUILDINGSTOREY categories since we don't process them in summaries anyway
      if (categoryName.includes('IFCBUILDINGSTOREY')) {
        console.log(
          ` ️  Skipping IFCBUILDINGSTOREY category "${categoryName}" (${
            JSON.stringify(categoryInfo.fullStructure).length
          } chars) - not needed for summary processing`
        )
        continue
      }

      const categoryData = {
        category: storeyChunk.data.category,
        localId: storeyChunk.data.localId,
        name: storeyChunk.data.name,
        children: categoryInfo.nodes,
        // Preserve original category structure information
        originalCategoryStructure: categoryInfo.fullStructure,
      }

      const categorySize = JSON.stringify(categoryData).length

      // If this category is still too large, sub-chunk it further
      if (categorySize > maxSubChunkSize) {
        console.log(
          ` Category "${categoryName}" is still too large (${categorySize} chars), sub-chunking further...`
        )

        const deepSubChunks = this.subChunkCategoryByElements(
          categoryData,
          categoryName,
          storeyChunk.storeyName,
          maxSubChunkSize
        )

        subChunks.push(...deepSubChunks)
      } else {
        subChunks.push({
          storeyName: storeyChunk.storeyName,
          categoryName: categoryName,
          data: categoryData,
          size: categorySize,
        })

        console.log(
          ` Created sub-chunk: "${storeyChunk.storeyName}/${categoryName}" (${categorySize} chars)`
        )
      }
    }

    // If no categories found, try to split by element groups
    if (subChunks.length === 0) {
      console.log(`️ No categories found, trying element-based chunking...`)

      const elementSubChunks = this.subChunkByElements(
        storeyChunk.data,
        storeyChunk.storeyName,
        maxSubChunkSize
      )
      subChunks.push(...elementSubChunks)
    }

    console.log(
      ` Sub-chunked "${storeyChunk.storeyName}" into ${subChunks.length} category-based chunks`
    )

    return subChunks
  }

  /**
   * Sub-chunk a category by its elements when the category is too large
   */
  static subChunkCategoryByElements(
    categoryData: any,
    categoryName: string,
    storeyName: string,
    maxSubChunkSize: number
  ): Array<{
    storeyName: string
    categoryName: string
    data: any
    size: number
    isDeepSubChunk: boolean
  }> {
    const subChunks: Array<{
      storeyName: string
      categoryName: string
      data: any
      size: number
      isDeepSubChunk: boolean
    }> = []

    // Collect all elements from this category
    const elements: any[] = []
    const collectElements = (node: any): void => {
      if (node.localId && typeof node.localId === 'number') {
        elements.push(node)
      }
      if (node.children) {
        node.children.forEach(collectElements)
      }
    }

    categoryData.children.forEach(collectElements)

    if (elements.length === 0) {
      console.log(
        `  No elements found in category "${categoryName}", keeping as single chunk`
      )
      return [
        {
          storeyName,
          categoryName,
          data: categoryData,
          size: JSON.stringify(categoryData).length,
          isDeepSubChunk: true,
        },
      ]
    }

    // Calculate optimal chunk size based on available elements and target size
    const totalDataSize = JSON.stringify(categoryData).length
    const avgElementSize = totalDataSize / elements.length

    // Calculate elements per chunk targeting 100-150KB chunks
    const targetChunkSize = 150000 // Target 150KB chunks
    const maxElementsPerChunk = Math.max(
      50, // Minimum 50 elements per chunk
      Math.floor(targetChunkSize / avgElementSize)
    )

    console.log(
      `  Splitting ${elements.length} elements into chunks of ~${maxElementsPerChunk} elements each (avg element size: ${avgElementSize} chars, targeting ~150KB chunks)`
    )

    // Split elements into chunks
    const elementChunks: any[][] = []
    for (let i = 0; i < elements.length; i += maxElementsPerChunk) {
      elementChunks.push(elements.slice(i, i + maxElementsPerChunk))
    }

    for (let i = 0; i < elementChunks.length; i++) {
      const elementGroup = elementChunks[i]
      const chunkIndex = i + 1

      // Create clean data structure without massive original children array
      const groupData = {
        category: categoryData.category,
        localId: categoryData.localId,
        name: categoryData.name,
        properties: categoryData.properties,
        // Only include the subset of elements, not the massive original children
        children: [
          {
            category: categoryName,
            localId: null,
            name: `${categoryName}_Part_${chunkIndex}`,
            children: elementGroup,
          },
        ],
      }

      const groupSize = JSON.stringify(groupData).length

      // Validate chunk size - if still too large, further split the elements
      if (groupSize > maxSubChunkSize) {
        console.log(
          `  ️  Chunk ${chunkIndex} is still too large (${groupSize} chars), splitting elements further...`
        )

        // If even a single element group is too large, split it in half
        const halfSize = Math.max(1, Math.floor(elementGroup.length / 2))

        // Split this element group into smaller pieces
        for (let j = 0; j < elementGroup.length; j += halfSize) {
          const smallerGroup = elementGroup.slice(j, j + halfSize)
          // Create clean data structure without massive original children array
          const smallerGroupData = {
            category: categoryData.category,
            localId: categoryData.localId,
            name: categoryData.name,
            properties: categoryData.properties,
            // Only include the subset of elements, not the massive original children
            children: [
              {
                category: categoryName,
                localId: null,
                name: `${categoryName}_Part_${chunkIndex}_${
                  Math.floor(j / halfSize) + 1
                }`,
                children: smallerGroup,
              },
            ],
          }

          const smallerGroupSize = JSON.stringify(smallerGroupData).length

          subChunks.push({
            storeyName,
            categoryName: `${categoryName}_part_${chunkIndex}_${
              Math.floor(j / halfSize) + 1
            }`,
            data: smallerGroupData,
            size: smallerGroupSize,
            isDeepSubChunk: true,
          })

          console.log(
            `  Created smaller deep sub-chunk: "${storeyName}/${categoryName}_part_${chunkIndex}_${
              Math.floor(j / halfSize) + 1
            }" (${smallerGroupSize} chars, ${smallerGroup.length} elements)`
          )
        }
      } else {
        subChunks.push({
          storeyName,
          categoryName: `${categoryName}_part_${chunkIndex}`,
          data: groupData,
          size: groupSize,
          isDeepSubChunk: true,
        })

        console.log(
          `  Created deep sub-chunk: "${storeyName}/${categoryName}_part_${chunkIndex}" (${groupSize} chars, ${elementGroup.length} elements)`
        )
      }
    }

    return subChunks
  }

  /**
   * Sub-chunk by elements when no categories are found
   */
  static subChunkByElements(
    data: any,
    containerName: string,
    maxSubChunkSize: number
  ): Array<{
    storeyName: string
    categoryName: string
    data: any
    size: number
    isDeepSubChunk?: boolean
  }> {
    const subChunks: Array<{
      storeyName: string
      categoryName: string
      data: any
      size: number
      isDeepSubChunk?: boolean
    }> = []

    // Collect all elements with localIds
    const elements: any[] = []
    const collectElements = (node: any): void => {
      if (node.localId && typeof node.localId === 'number') {
        elements.push(node)
      }
      if (node.children) {
        node.children.forEach(collectElements)
      }
    }

    collectElements(data)

    if (elements.length === 0) {
      // No elements found, return the data as-is
      return [
        {
          storeyName: containerName,
          categoryName: 'no_elements',
          data: data,
          size: JSON.stringify(data).length,
        },
      ]
    }

    // Split elements into groups of reasonable size
    const avgElementSize = JSON.stringify(data).length / elements.length
    const elementsPerChunk = Math.max(
      1,
      Math.floor(maxSubChunkSize / avgElementSize)
    )

    console.log(
      `  Element-based chunking: ${elements.length} elements, ~${elementsPerChunk} per chunk`
    )

    for (let i = 0; i < elements.length; i += elementsPerChunk) {
      const elementGroup = elements.slice(i, i + elementsPerChunk)
      const groupData = {
        category: data.category || 'ELEMENT_GROUP',
        localId: data.localId || null,
        name: data.name || `Group_${Math.floor(i / elementsPerChunk) + 1}`,
        children: elementGroup,
        // Preserve parent context
        parentContext: {
          category: data.category,
          localId: data.localId,
          name: data.name,
        },
      }

      const groupSize = JSON.stringify(groupData).length

      subChunks.push({
        storeyName: containerName,
        categoryName: `elements_${Math.floor(i / elementsPerChunk) + 1}`,
        data: groupData,
        size: groupSize,
      })

      console.log(
        ` Created element sub-chunk: "${containerName}/elements_${
          Math.floor(i / elementsPerChunk) + 1
        }" (${groupSize} chars, ${elementGroup.length} elements)`
      )
    }

    return subChunks
  }

  /**
   * chunking with sub-chunking for large storeys and metadata extraction
   */
  static chunkByStoreysWithSubChunking(
    node: SpatialNode,
    maxChunkSize: number = 180000,
    maxSubChunkSize: number = 180000,
    forceStoreyChunking: boolean = false
  ): {
    chunks: Array<{
      storeyName: string
      categoryName?: string
      data: any
      size: number
      isSubChunk?: boolean
      isDeepSubChunk?: boolean
    }>
    totalSize: number
    needsChunking: boolean
    hasSubChunks: boolean
    availableCategories: string[]
    availableLevels: string[]
  } {
    // Extract available categories and levels during processing
    const availableCategories = new Set<string>()
    const availableLevels = new Set<string>()

    // Helper function to extract metadata from a node
    const extractMetadata = (currentNode: SpatialNode): void => {
      if (currentNode.category && currentNode.category.startsWith('IFC')) {
        availableCategories.add(currentNode.category)
      }

      // Extract level names from building storey nodes - look in children for actual storey names
      if (currentNode.category?.includes('BUILDINGSTOREY')) {
        if (currentNode.children) {
          for (const child of currentNode.children) {
            if (child.localId && child.name) {
              availableLevels.add(child.name)
            }
          }
        }
      }

      if (currentNode.children) {
        currentNode.children.forEach(extractMetadata)
      }
    }

    // Extract metadata first
    extractMetadata(node)

    // Always chunk by storey if forced (for level-specific queries) or if size exceeds threshold
    const storeyResult = this.chunkByStoreys(
      node,
      maxChunkSize,
      forceStoreyChunking
    )

    // Always perform category sub-chunking for all storeys
    const finalChunks: Array<{
      storeyName: string
      categoryName?: string
      data: any
      size: number
      isSubChunk?: boolean
      isDeepSubChunk?: boolean
    }> = []

    let hasSubChunks = true // Always true since we always sub-chunk

    for (const storeyChunk of storeyResult.chunks) {
      console.log(
        ` Sub-chunking storey "${storeyChunk.storeyName}" (${storeyChunk.size} chars) by categories...`
      )

      const subChunks = this.subChunkByCategoriesRecursive(
        storeyChunk,
        maxSubChunkSize
      )

      finalChunks.push(
        ...subChunks.map((subChunk: any) => ({
          storeyName: subChunk.storeyName,
          categoryName: subChunk.categoryName,
          data: subChunk.data,
          size: subChunk.size,
          isSubChunk: true,
          isDeepSubChunk: subChunk.isDeepSubChunk,
        }))
      )
    }

    console.log(
      ` Final chunking: ${finalChunks.length} chunks (with category sub-chunking)`
    )

    return {
      chunks: finalChunks,
      totalSize: storeyResult.totalSize,
      needsChunking: true,
      hasSubChunks: true, // Always true since we always sub-chunk
      availableCategories: Array.from(availableCategories).sort(),
      availableLevels: Array.from(availableLevels).sort(),
    }
  }

  /**
   * chunk spatial structure by storeys for large models
   */
  static chunkByStoreys(
    node: SpatialNode,
    maxChunkSize: number = 50000,
    forceChunking: boolean = false
  ): {
    chunks: Array<{
      storeyName: string
      data: any
      size: number
    }>
    totalSize: number
    needsChunking: boolean
  } {
    const totalSize = JSON.stringify(node).length
    const needsChunking = totalSize > maxChunkSize || forceChunking

    if (!needsChunking) {
      return {
        chunks: [
          {
            storeyName: 'full_model',
            data: node,
            size: totalSize,
          },
        ],
        totalSize,
        needsChunking: false,
      }
    }

    const chunks: Array<{
      storeyName: string
      data: any
      size: number
    }> = []

    console.log(
      ` Starting storey search in structure of ${totalSize} characters...`
    )

    // Alternative approach: Look for storey-like nodes with specific naming patterns
    const findStoreyElements = (
      currentNode: SpatialNode,
      path: string[] = []
    ): void => {
      // Check if this node has a name that looks like a storey/level
      if (currentNode.name && currentNode.localId) {
        const nameLower = currentNode.name.toLowerCase()
        const isStoreyName =
          nameLower.includes('nivel') ||
          nameLower.includes('level') ||
          nameLower.includes('floor') ||
          nameLower.includes('storey') ||
          nameLower.includes('piso') ||
          nameLower.match(/^[bg]?\d+$/) || // B1, G, 1, 2, etc.
          nameLower.match(/^(ground|first|second|third|fourth|fifth)/) ||
          nameLower.match(/^l\d+/) || // L1, L2, etc.
          nameLower.includes('basement') ||
          nameLower.includes('parking')

        if (isStoreyName) {
          console.log(
            ` Found storey-like element: "${
              currentNode.name
            }" at path: ${path.join('/')}`
          )

          // Create a chunk for this storey including its children
          const storeyData = {
            category: 'STOREY_CHUNK',
            localId: currentNode.localId,
            name: currentNode.name,
            children: currentNode.children || [],
          }

          const chunkSize = JSON.stringify(storeyData).length
          chunks.push({
            storeyName: currentNode.name,
            data: storeyData,
            size: chunkSize,
          })

          console.log(
            ` Created chunk for storey element "${currentNode.name}" (${chunkSize} chars)`
          )

          // Don't recurse into this storey's children since we've captured it
          return
        }
      }

      // Continue searching in children
      if (currentNode.children) {
        for (let i = 0; i < currentNode.children.length; i++) {
          const child = currentNode.children[i]
          const childPath = [
            ...path,
            child.name || child.category || `index_${i}`,
          ]
          findStoreyElements(child, childPath)
        }
      }
    }

    const findStoreys = (
      currentNode: SpatialNode,
      path: string[] = []
    ): void => {
      // Check if this is a building storey/level
      if (
        currentNode.category?.includes('BUILDINGSTOREY') ||
        currentNode.category?.includes('LEVEL')
      ) {
        console.log(
          `️ Found BUILDINGSTOREY category node at path: ${path.join('/')}`
        )

        // Look for actual level name in children
        if (currentNode.children) {
          for (const child of currentNode.children) {
            if (child.localId && child.name) {
              console.log(
                ` Found storey element: "${child.name}" (localId: ${child.localId})`
              )

              // Found a storey - extract it as a chunk
              const storeyData = {
                category: currentNode.category,
                localId: null,
                name: null,
                children: [child], // Just this storey
              }

              const chunkSize = JSON.stringify(storeyData).length
              chunks.push({
                storeyName: child.name,
                data: storeyData,
                size: chunkSize,
              })

              console.log(
                ` Created chunk for storey "${child.name}" (${chunkSize} chars)`
              )
            }
          }
        }

        // Don't continue recursing into storey children since we've processed them
        return
      }

      // Continue searching for storeys in children
      if (currentNode.children) {
        for (let i = 0; i < currentNode.children.length; i++) {
          const child = currentNode.children[i]
          const childPath = [
            ...path,
            child.name || child.category || `index_${i}`,
          ]
          findStoreys(child, childPath)
        }
      }
    }

    // Try the standard approach first (look for IFCBUILDINGSTOREY categories)
    findStoreys(node)

    // If no chunks found with standard approach, try the alternative approach
    if (chunks.length === 0) {
      console.log(
        `️ No IFCBUILDINGSTOREY categories found, trying alternative storey detection...`
      )
      findStoreyElements(node)
    }

    // If still no storeys found, fall back to full model
    if (chunks.length === 0) {
      console.log(` No storeys detected, using full model as single chunk`)
      chunks.push({
        storeyName: 'full_model',
        data: node,
        size: totalSize,
      })
    }

    console.log(
      ` Chunked large model (${totalSize} chars) into ${chunks.length} storey chunks`
    )

    return {
      chunks,
      totalSize,
      needsChunking: true,
    }
  }
}
