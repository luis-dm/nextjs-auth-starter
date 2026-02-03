import * as THREE from "three";

// Type for BIM model objects
export interface BIMModel {
  raycast?: (params: {
    camera: THREE.Camera;
    mouse: THREE.Vector2;
    dom: HTMLElement;
  }) => Promise<RaycastResult | null>;
  getItemsData?: (
    ids: number[],
    options: { attributesDefault: boolean; attributes: string[] },
  ) => Promise<Array<{ Name?: { value: string } }>>;
  resetHighlight?: () => Promise<void>;
  highlight?: (ids: number[], material: HighlightMaterial) => Promise<void>;
  useCamera?: (camera: THREE.Camera) => void;
}

// Type for highlight material
export interface HighlightMaterial {
  color: THREE.Color;
  renderedFaces: number;
  opacity: number;
  transparent: boolean;
}

// Type for fragments manager
export interface FragmentsManager {
  list: Map<string, unknown>;
  core?: {
    update: (force?: boolean) => Promise<void>;
  };
}

export interface RaycastResult {
  point: THREE.Vector3;
  normal?: THREE.Vector3;
  distance: number;
  object?: THREE.Object3D;
  localId?: number;
}

export interface RaycastEntry {
  result: RaycastResult;
  model: BIMModel;
}

// Type for world object
export interface World {
  camera?: {
    three: THREE.Camera;
    controls?: {
      setLookAt: (
        px: number,
        py: number,
        pz: number,
        tx: number,
        ty: number,
        tz: number,
        enableTransition?: boolean,
      ) => void;
    };
  };
  scene?: {
    three: THREE.Scene & {
      parent?: THREE.Object3D | null;
    };
  };
  renderer?: {
    three: {
      domElement: HTMLElement;
      render?: (scene: THREE.Scene, camera: THREE.Camera) => void;
    };
  } | null;
}

/**
 * Centralized raycast utility for single-model workflows
 * Performs raycasting against the first (and only) loaded model
 */
export class RaycastUtils {
  /**
   * Perform raycast at screen coordinates
   * @param clientX - Screen X coordinate
   * @param clientY - Screen Y coordinate
   * @param camera - Three.js camera
   * @param canvas - Renderer DOM element
   * @param fragmentsManager - Fragments manager containing the model
   * @returns RaycastEntry with result and model, or null if no hit
   */
  static async performRaycast(
    clientX: number,
    clientY: number,
    camera: THREE.Camera,
    canvas: HTMLElement,
    fragmentsManager: FragmentsManager,
  ): Promise<RaycastEntry | null> {
    if (!camera || !canvas || !fragmentsManager?.list) {
      console.log("Missing requirements for raycast:", {
        camera: !!camera,
        canvas: !!canvas,
        fragments: !!fragmentsManager?.list,
      });
      return null;
    }

    try {
      // Use direct screen coordinates
      const mouse = new THREE.Vector2();
      mouse.x = clientX;
      mouse.y = clientY;

      console.log("Raycast coordinates:", {
        screen: { x: clientX, y: clientY },
      });

      // Get the first (and only) model since we only work with one model at a time
      const modelEntries = Array.from(fragmentsManager.list);
      if (modelEntries.length === 0) {
        console.log("No models loaded for raycast");
        return null;
      }

      const [modelId, model] = modelEntries[0] as [string, BIMModel];

      if (!model.raycast) {
        console.log("Model does not support raycast");
        return null;
      }

      const result = await model.raycast({
        camera,
        mouse,
        dom: canvas,
      });

      if (result) {
        // Only log serializable properties to avoid THREE.js object serialization errors
        console.log("Raycast hit from model:", {
          localId: result.localId,
          distance: result.distance,
          point: result.point
            ? { x: result.point.x, y: result.point.y, z: result.point.z }
            : null,
          hasNormal: !!result.normal,
          modelId,
        });
        return { result, model };
      } else {
        console.log("No raycast hits found");
        return null;
      }
    } catch (error) {
      console.error("Raycast failed:", error);
      return null;
    }
  }

  /**
   * Get element name from model using localId
   * @param model - The model to query
   * @param localId - The local ID of the element
   * @returns Element name or null if not found
   */
  static async getElementName(
    model: BIMModel,
    localId: number,
  ): Promise<string | null> {
    try {
      if (!model.getItemsData) {
        console.log("Model does not support getItemsData");
        return null;
      }

      const [data] = await model.getItemsData([localId], {
        attributesDefault: false,
        attributes: ["Name"],
      });

      const Name = data?.Name;
      if (!(Name && "value" in Name)) return null;
      return Name.value as string;
    } catch (error) {
      console.error("Error getting element name:", error);
      return null;
    }
  }

  /**
   * Convenience method for raycast with world and fragments refs
   * @param clientX - Screen X coordinate
   * @param clientY - Screen Y coordinate
   * @param worldRef - React ref to world object
   * @param fragmentsRef - React ref to fragments manager
   * @returns RaycastEntry with result and model, or null if no hit
   */
  static async performRaycastFromRefs(
    clientX: number,
    clientY: number,
    worldRef: React.RefObject<World | null>,
    fragmentsRef: React.RefObject<FragmentsManager | null>,
  ): Promise<RaycastEntry | null> {
    const world = worldRef.current;
    const fragments = fragmentsRef.current;

    if (
      !world?.camera?.three ||
      !world?.renderer?.three?.domElement ||
      !fragments
    ) {
      return null;
    }

    return this.performRaycast(
      clientX,
      clientY,
      world.camera.three,
      world.renderer.three.domElement,
      fragments,
    );
  }

  /**
   * Raycast from screen center (useful for first-person mode)
   * @param camera - Three.js camera
   * @param canvas - Renderer DOM element
   * @param fragmentsManager - Fragments manager containing the model
   * @returns RaycastEntry with result and model, or null if no hit
   */
  static async raycastFromCenter(
    camera: THREE.Camera,
    canvas: HTMLElement,
    fragmentsManager: FragmentsManager,
  ): Promise<RaycastEntry | null> {
    // Get canvas dimensions
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    return this.performRaycast(
      centerX,
      centerY,
      camera,
      canvas,
      fragmentsManager,
    );
  }
}
