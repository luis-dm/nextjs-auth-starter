"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import styles from "../viewer/viewer.module.scss";

// Types for the 3D components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Components = any;

export default function ClashPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const facilityId = params.id as string;
  const initializedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<Components | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");

  // Get all facility IDs from query params
  const facilityIds = searchParams.get("facilities")?.split(",") || [
    facilityId,
  ];

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      setIsLoading(true);

      const [
        { fragmentSetup },
        { resizeHandler },
        { createScene },
        { createModelsPanel },
        OBC,
        BUI,
        OBF,
      ] = await Promise.all([
        import("@/components/fragmentSetup"),
        import("@/components/resizeHandler"),
        import("@/components/SceneSetup"),
        import("@/components/panels/panel-components/modelsPanel"),
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

      setLoadingStatus("Creating 3D scene...");

      // SceneSetup.tsx
      const { world, components, viewport } = await createScene(container);

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

      // Set up models panel only
      setLoadingStatus("Setting up models panel...");
      const modelsPanel = BUI.Component.create(() =>
        createModelsPanel(components, (key: string) => key),
      );

      const panelDiv = document.createElement("div");
      panelDiv.style.position = "absolute";
      panelDiv.style.top = "10px";
      panelDiv.style.left = "10px";
      panelDiv.style.zIndex = "100";
      panelDiv.appendChild(modelsPanel);
      container.appendChild(panelDiv);

      // Load all facility fragments
      setLoadingStatus(`Loading ${facilityIds.length} facilities...`);
      let loadedCount = 0;

      for (const id of facilityIds) {
        try {
          console.log(`Fetching facility data for ID: ${id}`);
          setLoadingStatus(
            `Loading facility ${loadedCount + 1}/${facilityIds.length}...`,
          );

          const response = await fetch(`/api/facilities/${id}`);

          if (response.ok) {
            const facility = await response.json();
            console.log("Facility data received:", {
              name: facility.name,
              hasFragmentPath: !!facility.fragmentPath,
            });

            if (facility.fragmentPath) {
              // Fetch RENDERED fragment from volume API
              console.log(
                `Fetching rendered fragment for ${facility.name}...`,
              );
              const timestamp = Date.now();
              const fragmentResponse = await fetch(
                `/api/fragments/${id}?type=rendered&t=${timestamp}`,
              );

              if (fragmentResponse.ok) {
                const fragmentBuffer = await fragmentResponse.arrayBuffer();

                console.log("Loading fragments into scene...", {
                  bufferSize: fragmentBuffer.byteLength,
                  facilityName: facility.name,
                });

                // Load the fragments with unique model name
                const modelName =
                  facility.ifcFileName?.replace(".ifc", "") || facility.name;
                await fragments.core.load(fragmentBuffer, {
                  modelId: `${modelName}_${id}`,
                });

                console.log(
                  `Fragments loaded successfully for facility: ${facility.name}`,
                );
                loadedCount++;
              } else {
                console.error(
                  `Failed to fetch fragment from volume for ${facility.name}`,
                );
              }
            } else {
              console.log(`No fragment data available for ${facility.name}`);
            }
          } else {
            console.error(`Failed to fetch facility data for ID: ${id}`);
          }
        } catch (error) {
          console.error(`Error loading facility ${id}:`, error);
        }
      }

      setLoadingStatus(
        `Loaded ${loadedCount} of ${facilityIds.length} facilities`,
      );
      console.log(
        `Clash detection ready: ${loadedCount} facilities loaded for comparison`,
      );

      setIsLoading(false);
    };
    init();
  }, [facilityId, facilityIds]);

  return (
    <div className={styles.pageContainer}>
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium">{loadingStatus}</p>
            <p className="text-gray-500 text-sm mt-2">
              Loading {facilityIds.length} facilities for clash detection
            </p>
          </div>
        </div>
      )}
      <div className={styles.contentArea}>
        <div ref={containerRef} className={styles.viewerContainer} />
      </div>
    </div>
  );
}
