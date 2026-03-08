import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

// Add BVH capabilities to THREE.BufferGeometry
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export interface ClashResult {
  id: string;
  elementA: {
    modelId: string;
    modelName: string;
    itemId: number;
    guid?: string;
    category?: string;
  };
  elementB: {
    modelId: string;
    modelName: string;
    itemId: number;
    guid?: string;
    category?: string;
  };
  distance: number;
  position?: THREE.Vector3;
}

interface ElementMeshData {
  modelId: string;
  modelName: string;
  itemId: number;
  guid?: string;
  category?: string;
  mesh: THREE.Mesh;
  boundingBox: THREE.Box3;
}

export class ClashDetector {
  private components: OBC.Components;
  private fragments: OBC.FragmentsManager;
  private highlighter?: OBF.Highlighter;

  constructor(components: OBC.Components) {
    this.components = components;
    this.fragments = components.get(OBC.FragmentsManager);
    try {
      this.highlighter = components.get(OBF.Highlighter);
    } catch (e) {
      console.warn("Highlighter not available");
    }
  }

  /**
   * Run clash detection on all loaded models
   */
  async detectClashes(
    tolerance: number = 0.01,
    onProgress?: (current: number, total: number) => void,
  ): Promise<ClashResult[]> {
    const clashes: ClashResult[] = [];

    // Get all loaded models
    const models = Array.from(this.fragments.list.values());
    console.log(`Starting clash detection for ${models.length} models`);

    if (models.length < 2) {
      throw new Error("At least 2 models are required for clash detection");
    }

    // Prepare mesh data for each element across all models
    const elementMeshes: ElementMeshData[] = [];

    for (const model of models) {
      const modelName = model.modelId;
      console.log(`Processing model: ${modelName}`);

      // Get all items with geometry from the model
      const itemIds = await model.getItemsIdsWithGeometry();
      console.log(`  Found ${itemIds.length} items with geometry`);

      if (itemIds.length === 0) {
        console.warn(`  Model ${modelName} has no items with geometry`);
        continue;
      }

      // Get additional metadata for items (GUIDs and categories)
      const guids = await model.getGuidsByLocalIds(itemIds);
      const categories = await model.getItemsWithGeometryCategories();
      const categoryMap = new Map<number, string>();
      
      // Build category map (this is approximate, may need refinement)
      itemIds.forEach((id, idx) => {
        if (categories[idx]) {
          categoryMap.set(id, categories[idx]);
        }
      });

      // Get the geometry data for items
      const geometryData = await model.getItemsGeometry(itemIds);
      console.log(`  Processing ${geometryData.length} elements...`);

      // Process each element individually
      for (let i = 0; i < geometryData.length; i++) {
        const meshDataArray = geometryData[i];
        const itemId = itemIds[i];
        const guid = guids[i] || undefined;
        const category = categoryMap.get(itemId) || undefined;

        if (!meshDataArray || meshDataArray.length === 0) continue;

        const positions: number[] = [];
        const indices: number[] = [];
        let vertexOffset = 0;

        // Combine all mesh data for this element
        for (const meshData of meshDataArray) {
          if (!meshData.positions || !meshData.transform) continue;

          const posArray = meshData.positions;
          const transform = meshData.transform;

          // Transform each vertex by the mesh's transform matrix
          const vertex = new THREE.Vector3();
          const vertexCount = posArray.length / 3;

          for (let j = 0; j < vertexCount; j++) {
            vertex.set(
              posArray[j * 3],
              posArray[j * 3 + 1],
              posArray[j * 3 + 2],
            );
            vertex.applyMatrix4(transform);
            positions.push(vertex.x, vertex.y, vertex.z);
          }

          // Get indices
          if (meshData.indices && meshData.indices.length > 0) {
            for (let j = 0; j < meshData.indices.length; j++) {
              indices.push(meshData.indices[j] + vertexOffset);
            }
          } else {
            // No indices, create sequential ones
            for (let j = 0; j < vertexCount; j++) {
              indices.push(j + vertexOffset);
            }
          }

          vertexOffset += vertexCount;
        }

        if (positions.length === 0) continue;

        // Create geometry for this element
        const elementGeometry = new THREE.BufferGeometry();
        elementGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        elementGeometry.setIndex(indices);

        // Compute BVH for this element
        (elementGeometry as any).computeBoundsTree();

        const mesh = new THREE.Mesh(
          elementGeometry,
          new THREE.MeshBasicMaterial(),
        );

        // Compute bounding box
        elementGeometry.computeBoundingBox();
        const boundingBox = elementGeometry.boundingBox!;

        elementMeshes.push({
          modelId: model.modelId,
          modelName,
          itemId,
          guid,
          category,
          mesh,
          boundingBox,
        });
      }
    }

    console.log(`Total elements prepared: ${elementMeshes.length}`);

    // Compare elements from different models
    const modelIds = [...new Set(elementMeshes.map((e) => e.modelId))];
    let totalComparisons = 0;
    
    // Count total comparisons needed
    for (let i = 0; i < modelIds.length; i++) {
      for (let j = i + 1; j < modelIds.length; j++) {
        const elementsA = elementMeshes.filter((e) => e.modelId === modelIds[i]);
        const elementsB = elementMeshes.filter((e) => e.modelId === modelIds[j]);
        totalComparisons += elementsA.length * elementsB.length;
      }
    }

    console.log(`Running ${totalComparisons} element-to-element comparisons...`);
    let currentComparison = 0;

    for (let i = 0; i < modelIds.length; i++) {
      for (let j = i + 1; j < modelIds.length; j++) {
        const elementsA = elementMeshes.filter((e) => e.modelId === modelIds[i]);
        const elementsB = elementMeshes.filter((e) => e.modelId === modelIds[j]);

        console.log(
          `Checking ${elementsA.length} x ${elementsB.length} element pairs between models`,
        );

        for (const elementA of elementsA) {
          for (const elementB of elementsB) {
            currentComparison++;
            if (currentComparison % 100 === 0) {
              onProgress?.(currentComparison, totalComparisons);
            }

            // Quick bounding box check first
            if (!elementA.boundingBox.intersectsBox(elementB.boundingBox)) {
              continue;
            }

            // Check for intersection using BVH
            const geometryA = elementA.mesh.geometry as any;
            const geometryB = elementB.mesh.geometry as any;

            if (!geometryA.boundsTree || !geometryB.boundsTree) {
              continue;
            }

            // Use identity matrix since we already applied world transforms
            const identity = new THREE.Matrix4();
            const hasIntersection = geometryA.boundsTree.intersectsGeometry(
              geometryB,
              identity,
            );

            if (hasIntersection) {
              console.log(
                `CLASH: ${elementA.category || "Element"} (${elementA.guid || elementA.itemId}) ↔ ${elementB.category || "Element"} (${elementB.guid || elementB.itemId})`,
              );

              // Calculate approximate penetration depth
              const overlappingBox = elementA.boundingBox
                .clone()
                .intersect(elementB.boundingBox);
              const size = new THREE.Vector3();
              overlappingBox.getSize(size);
              const distance = Math.min(size.x, size.y, size.z);

              const center = new THREE.Vector3();
              overlappingBox.getCenter(center);

              clashes.push({
                id: `clash-${elementA.modelId}-${elementA.itemId}-${elementB.modelId}-${elementB.itemId}`,
                elementA: {
                  modelId: elementA.modelId,
                  modelName: elementA.modelName,
                  itemId: elementA.itemId,
                  guid: elementA.guid,
                  category: elementA.category,
                },
                elementB: {
                  modelId: elementB.modelId,
                  modelName: elementB.modelName,
                  itemId: elementB.itemId,
                  guid: elementB.guid,
                  category: elementB.category,
                },
                distance,
                position: center,
              });
            }
          }
        }
      }
    }

    // Clean up geometries
    elementMeshes.forEach((elementData) => {
      elementData.mesh.geometry.dispose();
    });

    console.log(`Clash detection complete: found ${clashes.length} clashes`);
    return clashes;
  }

  /**
   * Highlight clashing elements in red
   */
  highlightClashes(clashes: ClashResult[]): void {
    if (!this.highlighter) {
      console.warn("Highlighter not available");
      return;
    }

    // Clear previous highlights
    this.highlighter.clear();

    // Collect all clashing item IDs per model
    const clashingItems = new Map<string, Set<number>>();
    
    clashes.forEach((clash) => {
      if (!clashingItems.has(clash.elementA.modelId)) {
        clashingItems.set(clash.elementA.modelId, new Set());
      }
      if (!clashingItems.has(clash.elementB.modelId)) {
        clashingItems.set(clash.elementB.modelId, new Set());
      }
      
      clashingItems.get(clash.elementA.modelId)!.add(clash.elementA.itemId);
      clashingItems.get(clash.elementB.modelId)!.add(clash.elementB.itemId);
    });

    console.log(`Highlighting ${Array.from(clashingItems.values()).reduce((sum, set) => sum + set.size, 0)} clashing elements`);

    // Build ModelIdMap for highlighting
    const selectionMap: OBC.ModelIdMap = {};
    clashingItems.forEach((itemIds, modelId) => {
      selectionMap[modelId] = itemIds;
    });

    // Define custom red material style
    const redStyle = "clash-highlight";
    this.highlighter!.styles.set(redStyle, {
      color: new THREE.Color("#ef4444"), // Red
      renderedFaces: 1,
      opacity: 0.8,
      transparent: true,
    });

    // Highlight using the highlightByID method
    this.highlighter!.highlightByID(redStyle, selectionMap);
  }

  /**
   * Clear clash highlights
   */
  clearHighlights(): void {
    if (!this.highlighter) {
      return;
    }
    // Clear the custom clash highlight style
    this.highlighter.clear("clash-highlight");
  }
}
