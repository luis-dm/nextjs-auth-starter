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
    guid?: string;
    category?: string;
  };
  elementB: {
    modelId: string;
    modelName: string;
    guid?: string;
    category?: string;
  };
  distance: number;
  position?: THREE.Vector3;
}

interface ModelMeshData {
  modelId: string;
  modelName: string;
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

    // Prepare mesh data for each model
    const modelMeshes: ModelMeshData[] = [];

    for (const model of models) {
      const modelName = model.modelId;
      console.log(`Processing model: ${modelName}`);

      // Get the model's object (which contains the meshes)
      const object = model.object;

      if (!object) {
        console.warn(`Model ${modelName} has no object`);
        continue;
      }

      // Combine all meshes in the model into a single mesh for clash detection
      const combinedGeometry = new THREE.BufferGeometry();
      const positions: number[] = [];
      const indices: number[] = [];
      let vertexOffset = 0;

      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          const geometry = child.geometry;

          // Get position attribute
          const posAttr = geometry.getAttribute("position");
          if (!posAttr) return;

          // Apply world matrix transformation to each vertex as we read it
          const vertex = new THREE.Vector3();
          for (let i = 0; i < posAttr.count; i++) {
            vertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            vertex.applyMatrix4(child.matrixWorld);
            positions.push(vertex.x, vertex.y, vertex.z);
          }

          // Get index attribute
          const indexAttr = geometry.index;
          if (indexAttr) {
            for (let i = 0; i < indexAttr.count; i++) {
              indices.push(indexAttr.getX(i) + vertexOffset);
            }
          } else {
            // No index, create one
            for (let i = 0; i < posAttr.count; i++) {
              indices.push(i + vertexOffset);
            }
          }

          vertexOffset += posAttr.count;
        }
      });

      if (positions.length === 0) {
        console.warn(`Model ${modelName} has no geometry`);
        continue;
      }

      combinedGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      combinedGeometry.setIndex(indices);

      // Compute BVH for this model
      console.log(`Computing BVH for ${modelName}...`);
      (combinedGeometry as any).computeBoundsTree();

      const mesh = new THREE.Mesh(
        combinedGeometry,
        new THREE.MeshBasicMaterial(),
      );

      // Compute bounding box for quick rejection
      combinedGeometry.computeBoundingBox();
      const boundingBox = combinedGeometry.boundingBox!.clone();

      modelMeshes.push({
        modelId: model.modelId,
        modelName,
        mesh,
        boundingBox,
      });
    }

    console.log(`Prepared ${modelMeshes.length} models for clash detection`);

    // Compare each pair of models
    const totalComparisons =
      (modelMeshes.length * (modelMeshes.length - 1)) / 2;
    let currentComparison = 0;

    for (let i = 0; i < modelMeshes.length; i++) {
      for (let j = i + 1; j < modelMeshes.length; j++) {
        currentComparison++;
        onProgress?.(currentComparison, totalComparisons);

        const modelA = modelMeshes[i];
        const modelB = modelMeshes[j];

        console.log(
          `Checking clash between ${modelA.modelName} and ${modelB.modelName}`,
        );

        // Quick bounding box check first
        if (!modelA.boundingBox.intersectsBox(modelB.boundingBox)) {
          console.log("No bounding box intersection, skipping");
          continue;
        }

        // Check for intersection using BVH
        const geometryA = modelA.mesh.geometry as any;
        const geometryB = modelB.mesh.geometry as any;

        if (!geometryA.boundsTree || !geometryB.boundsTree) {
          console.warn("BVH not computed for one or both models");
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
            `CLASH DETECTED between ${modelA.modelName} and ${modelB.modelName}`,
          );

          // Calculate approximate penetration depth
          const overlappingBox = modelA.boundingBox
            .clone()
            .intersect(modelB.boundingBox);
          const size = new THREE.Vector3();
          overlappingBox.getSize(size);
          const distance = Math.min(size.x, size.y, size.z);

          const center = new THREE.Vector3();
          overlappingBox.getCenter(center);

          clashes.push({
            id: `clash-${modelA.modelId}-${modelB.modelId}`,
            elementA: {
              modelId: modelA.modelId,
              modelName: modelA.modelName,
            },
            elementB: {
              modelId: modelB.modelId,
              modelName: modelB.modelName,
            },
            distance,
            position: center,
          });
        }
      }
    }

    // Clean up geometries
    modelMeshes.forEach((modelData) => {
      modelData.mesh.geometry.dispose();
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

    // Highlight each clashing model
    const modelIds = new Set<string>();
    clashes.forEach((clash) => {
      modelIds.add(clash.elementA.modelId);
      modelIds.add(clash.elementB.modelId);
    });

    console.log(`Highlighting ${modelIds.size} clashing models`);

    // Set up material for clash highlighting
    const clashMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ef4444"), // Red color for clashes
      transparent: true,
      opacity: 0.8,
      depthTest: true,
    });

    modelIds.forEach((modelId) => {
      const model = this.fragments.list.get(modelId);
      if (model?.object) {
        model.object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // Store original material if not already stored
            if (!(child as any)._originalMaterial) {
              (child as any)._originalMaterial = child.material;
            }
            child.material = clashMaterial;
          }
        });
      }
    });
  }

  /**
   * Clear clash highlights
   */
  clearHighlights(): void {
    if (!this.highlighter) {
      return;
    }

    this.highlighter.clear();

    // Restore original materials
    this.fragments.list.forEach((model) => {
      if (model.object) {
        model.object.traverse((child) => {
          if (child instanceof THREE.Mesh && (child as any)._originalMaterial) {
            child.material = (child as any)._originalMaterial;
            delete (child as any)._originalMaterial;
          }
        });
      }
    });
  }
}
