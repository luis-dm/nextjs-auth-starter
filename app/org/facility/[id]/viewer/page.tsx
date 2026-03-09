"use client";

import dynamic from "next/dynamic";
import { PropertiesButton } from "@/components/ui/PropertiesButton";
import { BCFTopicsButton } from "@/components/ui/BCFTopicsButton";
import { World, FragmentsManager } from "@/utils/raycastUtils";
import styles from "./viewer.module.scss";
import { setTypeIndex } from "@/utils/ifcTypeIndexCache";

// Dynamically import PropertiesPanel to avoid SSR issues with @thatopen/ui-obc
const PropertiesPanel = dynamic(
  () =>
    import("@/components/ui/PropertiesPanel").then((mod) => ({
      default: mod.PropertiesPanel,
    })),
  { ssr: false },
);

// Dynamically import BCFPanel to avoid SSR issues with @thatopen/components
const BCFPanel = dynamic(
  () =>
    import("@/components/ui/BCFPanel").then((mod) => ({
      default: mod.BCFPanel,
    })),
  { ssr: false },
);
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

// Types for the 3D components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Components = any;

interface FacilityUser {
  id: string;
  name: string | null;
  email: string;
}

export default function ViewerPage() {
  const params = useParams();
  const facilityId = params.id as string;
  const { data: session } = useSession();
  const initializedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // State for raycasting functionality
  const worldRef = useRef<World | null>(null);
  const fragmentsRef = useRef<FragmentsManager | null>(null);
  const componentsRef = useRef<Components | null>(null);

  // State for properties panel
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
  const [isBCFTopicsOpen, setIsBCFTopicsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [facilityUsers, setFacilityUsers] = useState<FacilityUser[]>([]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      setIsLoading(true);

      const [
        { fragmentSetup },
        { resizeHandler },
        { createScene },
        { uiHandlers },
        { panelHandlers },
        OBC,
        BUI,
        OBF,
      ] = await Promise.all([
        import("@/components/fragmentSetup"),
        import("@/components/resizeHandler"),
        import("@/components/SceneSetup"),
        import("@/components/modelHandlers"),
        import("@/components/panels/panelHandlers"),
        import("@thatopen/components"),
        import("@thatopen/ui"),
        import("@thatopen/components-front"),
      ]);

      if (!containerRef.current) {
        console.error("Container not available.");
        return;
      }

      const container = containerRef.current!;

      BUI.Manager.init();

      // SceneSetup.tsx
      const { world, components, viewport } = await createScene(container);

      // Store references for raycasting
      worldRef.current = world;
      componentsRef.current = components;
      componentsRef.current = components;

      if (!world.renderer) {
        console.error("World renderer unavailable after scene setup.");
        return;
      }

      resizeHandler({
        scene: world.scene,
        camera: world.camera,
        renderer: world.renderer,
      });

      const { fragments } = fragmentSetup(components, {
        scene: world.scene,
        camera: world.camera,
        renderer: world.renderer,
      });

      // Store fragments reference for raycasting
      fragmentsRef.current = fragments;

      // Set up auto-render BEFORE loading any fragments
      fragments.list.onItemSet.add(async ({ value: model }) => {
        console.log("New model loaded, setting up rendering:", model);

        // 1. Set the camera for the model
        model.useCamera(world.camera.three);

        // 2. Set up clipping planes integration
        model.getClippingPlanesEvent = () => {
          return Array.from(world.renderer!.three.clippingPlanes) || [];
        };

        // 3. Add the model to the 3D scene
        world.scene.three.add(model.object);
        console.log("Model added to scene:", model.object);

        // 4. Update the fragments core to render properly
        await fragments.core.update(true);
        console.log("Fragments core updated, model should be visible");

        // 5. Load spatial structure after model is ready
        try {
          const { loadSpatialStructureAfterModel } =
            await import("@/components/panels/panel-components/chatbotPanel");
          await loadSpatialStructureAfterModel(facilityId);
        } catch (error) {
          console.error("Failed to load spatial structure:", error);
        }
      });

      // Set up camera projection change handler
      world.camera.projection.onChanged.add(() => {
        for (const [, model] of fragments.list) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const modelAny = model as any;
          modelAny.useCamera?.(world.camera.three);
        }
      });

      world.camera.controls.addEventListener("rest", () => {
        fragments.core.update(true);
      });

      const ifcLoader = components.get(OBC.IfcLoader);
      await ifcLoader.setup({
        autoSetWasm: false,
        wasm: { absolute: true, path: "https://unpkg.com/web-ifc@0.0.69/" },
      });

      console.log(ifcLoader);

      await uiHandlers(components, world, viewport);

      // Set up panels (spatial tree, toolbar) - models panel removed
      await panelHandlers(components, world, container);

      // Fetch and load the facility's fragment data
      try {
        console.log(`Fetching facility data for ID: ${facilityId}`);
        const response = await fetch(`/api/facilities/${facilityId}`);

        if (response.ok) {
          const facility = await response.json();
          console.log("Facility data received:", {
            name: facility.name,
            hasFragmentPath: !!facility.fragmentPath,
          });

          // Extract facility users from members
          if (facility.members && Array.isArray(facility.members)) {
            const users = facility.members.map((member: any) => ({
              id: member.user.id,
              name: member.user.name,
              email: member.user.email,
            }));
            setFacilityUsers(users);
          }

          if (facility.fragmentPath) {
            // Cache the type property index if available
            if (facility.typePropertyIndex) {
              const modelName =
                facility.ifcFileName?.replace(".ifc", "") || facility.name;
              setTypeIndex(modelName, facility.typePropertyIndex);
              console.log(
                "✅ Type property index cached for model:",
                modelName,
              );
              console.log("📊 Index structure:", {
                hasOccurrenceToType:
                  !!facility.typePropertyIndex.occurrenceToType,
                hasTypeToPsets: !!facility.typePropertyIndex.typeToPsets,
                hasPsetToProperties:
                  !!facility.typePropertyIndex.psetToProperties,
                hasPropertyValues: !!facility.typePropertyIndex.propertyValues,
                hasPsetNames: !!facility.typePropertyIndex.psetNames,
              });
            } else {
              console.warn("⚠️ No type property index found in facility data");
            }

            // Fetch RENDERED fragment from volume API (viewer shows baked edits)
            console.log("Fetching rendered fragment from volume...");
            const timestamp = Date.now();
            const fragmentResponse = await fetch(
              `/api/fragments/${facilityId}?type=rendered&t=${timestamp}`,
            );

            if (fragmentResponse.ok) {
              const fragmentBuffer = await fragmentResponse.arrayBuffer();

              console.log("Loading fragments into scene...", {
                bufferSize: fragmentBuffer.byteLength,
                facilityName: facility.name,
              });

              // Load the fragments
              const modelName =
                facility.ifcFileName?.replace(".ifc", "") || facility.name;
              await fragments.core.load(fragmentBuffer, {
                modelId: modelName,
              });

              console.log(
                `Fragments loaded successfully for facility: ${facility.name}`,
              );
            } else {
              console.error("Failed to fetch fragment from volume");
            }
          } else {
            console.log("No fragment data available for this facility");
          }
        } else {
          console.error("Failed to fetch facility data");
        }
      } catch (error) {
        console.error("Error loading facility fragments:", error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [facilityId]);

  // Handle properties button click
  const handleProperties = () => {
    setIsPropertiesOpen(true);
  };

  // Handle properties panel close
  const handlePropertiesClose = () => {
    setIsPropertiesOpen(false);
  };

  // Handle BCF topics button click
  const handleBCFTopics = () => {
    setIsBCFTopicsOpen(true);
  };

  // Handle BCF topics panel close
  const handleBCFTopicsClose = () => {
    setIsBCFTopicsOpen(false);
  };

  return (
    <div className={styles.pageContainer}>
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium">Loading facility...</p>
          </div>
        </div>
      )}
      <div className={styles.contentArea}>
        <div ref={containerRef} className={styles.viewerContainer} />
        <PropertiesButton onClick={handleProperties} />
        <BCFTopicsButton onClick={handleBCFTopics} />
        <PropertiesPanel
          isOpen={isPropertiesOpen}
          onClose={handlePropertiesClose}
          components={componentsRef.current || undefined}
        />
        <BCFPanel
          isOpen={isBCFTopicsOpen}
          onClose={handleBCFTopicsClose}
          components={componentsRef.current || undefined}
          world={worldRef.current || undefined}
          userEmail={session?.user?.email || undefined}
          facilityUsers={facilityUsers}
          facilityId={facilityId}
        />
      </div>
    </div>
  );
}
