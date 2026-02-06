"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GeneralEditor, type TableData } from "@/components/edit/GeneralEditor";
import {
  createEditorPanel,
  type EditorPanelConfig,
} from "@/components/edit/EditorPanel";

/* MD
  ## Editing BIM Elements 🪑
  ---
  In this tutorial, we'll explore how to easily edit BIM elements using the Fragments Edit API. We will move things around, change its materials, edit its instance attributes, register everything in a history that we can revert and more. Let's dive in!
*/

// Global variables for the libraries
let OBC: any;
let THREE: any;
let BUI: any;
let FRAGS: any;
let TransformControls: any;

// Global variables for the scene
let components: any;
let worlds: any;
let world: any;
let fragments: any;
let model: any;
let generalEditor: any;

// TransformControls import
const loadTransformControls = async () => {
  const { TransformControls: TC } =
    await import("three/examples/jsm/controls/TransformControls.js");
  return TC;
};

export default function BIMEditPage() {
  const params = useParams();
  const facilityId = params.id as string;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let editorPanel: HTMLElement | null = null;

    const runExample = async () => {
      try {
        console.log("Initializing BIM Edit Example...");

        // Dynamic imports to avoid SSR issues
        const [
          OBCModule,
          THREEModule,
          BUIModule,
          FRAGSModule,
          //   StatsModule
        ] = await Promise.all([
          import("@thatopen/components"),
          import("three"),
          import("@thatopen/ui"),
          import("@thatopen/fragments"),
          //   import('stats.js')
        ]);

        // Load TransformControls
        TransformControls = await loadTransformControls();

        // Assign to global variables
        OBC = OBCModule;
        THREE = THREEModule;
        BUI = BUIModule;
        FRAGS = FRAGSModule;
        // Stats = StatsModule.default;

        /* MD
          ### 🌎 Setting up a Simple Scene
          To get started, let's set up a basic ThreeJS scene. This will serve as the foundation for our application and allow us to visualize the 3D models effectively:
        */

        const container = document.getElementById(
          "container",
        ) as HTMLDivElement;

        components = new OBC.Components();
        worlds = components.get(OBC.Worlds);

        world = worlds.create();

        world.scene = new OBC.ShadowedScene(components);
        world.renderer = new OBC.SimpleRenderer(components, container);
        world.camera = new OBC.OrthoPerspectiveCamera(components);

        components.init();

        world.scene.three.add(new THREE.AxesHelper());

        world.camera.three.far = 10000;

        world.renderer.three.shadowMap.enabled = true;
        world.renderer.three.shadowMap.type = THREE.PCFSoftShadowMap;

        world.scene.setup({
          shadows: {
            cascade: 1,
            resolution: 1024,
          },
        });

        await world.scene.updateShadows();

        // Set background color after scene setup to prevent it from being overridden
        world.scene.three.background = new THREE.Color(0xffffff);

        const worldGrid = components.get(OBC.Grids).create(world);
        worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
        worldGrid.material.uniforms.uSize1.value = 2;
        worldGrid.material.uniforms.uSize2.value = 8;
        world.camera.controls.addEventListener("rest", async () => {
          await world.scene.updateShadows();
        });

        /* MD
          ### 🛠️ Setting Up Fragments
          Now, let's configure the Fragments library core. This will allow us to load models effortlessly and start manipulating them with ease:
        */

        const workerUrl = "/workers/fragworker.mjs";
        fragments = new FRAGS.FragmentsModels(workerUrl);

        world.camera.controls.addEventListener("control", () =>
          fragments.update(),
        );

        // Once a model is available in the list, we can tell what camera to use
        fragments.models.list.onItemSet.add(({ value: model }: any) => {
          model.useCamera(world.camera.three);
          world.scene.three.add(model.object);

          // Set up shadows
          model.tiles.onItemSet.add(({ value: mesh }: any) => {
            if ("isMesh" in mesh) {
              const mat = mesh.material as any[];
              if (mat[0].opacity === 1) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
              }
            }
          });
        });

        /* MD
          ### 📂 Model Loading Function
        */

        // Function to load a fragment model and initialize the editor
        const loadModelAndInitializeEditor = async (
          buffer: ArrayBuffer,
          fileName: string = "facility_model",
          historyData?: ArrayBuffer,
        ) => {
          try {
            // Load the model
            model = await fragments.load(buffer, {
              modelId: "facility_model",
              camera: world.camera.three,
            });

            world.scene.three.add(model.object);
            await fragments.update(true);

            // Initialize the editor
            generalEditor = new GeneralEditor({
              world,
              OBC,
              THREE,
              FRAGS,
              TransformControls,
              fragments,
              model,
            });
            await generalEditor.init();

            // Initialize the editor UI first
            initializeEditorUI();

            // Load edit history AFTER UI is initialized
            if (historyData) {
              try {
                const historyJson = new TextDecoder().decode(historyData);
                const { requests, undoneRequests } = JSON.parse(historyJson);

                // Restore edit history
                if (requests && requests.length > 0) {
                  await fragments.editor.edit(model.modelId, requests, {
                    removeRedo: false,
                  });
                  console.log(
                    `Loaded ${requests.length} edit history requests`,
                  );

                  // Trigger history UI update after a short delay to ensure DOM is ready
                  setTimeout(() => {
                    fragments.editor.onEdit.trigger();
                  }, 100);
                }
              } catch (error) {
                console.warn("Error loading edit history:", error);
              }
            }

            console.log(`Model "${fileName}" loaded successfully`);
          } catch (error) {
            console.error("Error loading model:", error);
            alert("Error loading the fragment model.");
          }
        };

        /* MD
          ### 🧩 Initialize Editor UI Function
        */

        // Function to initialize all editor UI after model is loaded
        const initializeEditorUI = () => {
          // Export model function - save to database and return to dashboard
          const exportModel = async () => {
            // Create loading overlay matching viewer style
            const loadingOverlay = document.createElement("div");
            loadingOverlay.className = "absolute inset-0 z-50 flex items-center justify-center";
            loadingOverlay.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(17, 24, 39, 0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 9999;
            `;
            
            const card = document.createElement("div");
            card.style.cssText = `
              background: white;
              border-radius: 0.5rem;
              padding: 1.5rem;
              display: flex;
              flex-direction: column;
              align-items: center;
            `;
            
            const spinner = document.createElement("div");
            spinner.style.cssText = `
              width: 3rem;
              height: 3rem;
              border: 4px solid #3B82F6;
              border-top-color: transparent;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 1rem;
            `;
            
            const message = document.createElement("p");
            message.style.cssText = `
              color: #374151;
              font-weight: 500;
              margin: 0;
            `;
            message.textContent = "Saving model...";
            
            card.appendChild(spinner);
            card.appendChild(message);
            loadingOverlay.appendChild(card);
            
            // Add spinner animation if not already present
            if (!document.getElementById('spinner-animation')) {
              const style = document.createElement("style");
              style.id = 'spinner-animation';
              style.textContent = `
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `;
              document.head.appendChild(style);
            }
            document.body.appendChild(loadingOverlay);
            
            try {
              // Get edit history BEFORE saving (save clears the history)
              const { requests, undoneRequests } =
                await fragments.editor.getModelRequests(model.modelId);
              const historyData = {
                requests,
                undoneRequests,
              };
              const historyJson = JSON.stringify(historyData);
              const historyBytes = new TextEncoder().encode(historyJson);

              console.log("Edit history before save:", {
                requestsCount: requests.length,
                undoneRequestsCount: undoneRequests.length,
              });

              // Get the buffer BEFORE saving (save might clear the model)
              const exportedBuffer = await model.getBuffer();
              const exportedBytes = new Uint8Array(exportedBuffer);

              // Save the edits to the model (this applies edits but might clear scene)
              await fragments.editor.save(model.modelId);

              // Save to volume via API
              const response = await fetch(`/api/facilities/${facilityId}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fragmentData: Array.from(exportedBytes),
                  editHistory: Array.from(historyBytes),
                }),
              });

              if (!response.ok) {
                throw new Error("Failed to save fragment data");
              }

              console.log(
                "Fragment data and edit history saved successfully",
              );

              // Navigate back to facility dashboard
              window.location.href = "/org/facility";
            } catch (error) {
              console.error("Error saving model:", error);
              document.body.removeChild(loadingOverlay);
              alert("Error saving the model. Please try again.");
            }
          };

          // Create editor panel configuration
          const editorConfig: EditorPanelConfig = {
            generalEditor,
            exportModel,
            BUI,
            fragments,
            model,
            FRAGS,
            updateHistoryContainer: async () => {}, // Will be replaced by the component
          };

          // Create the editor panel
          const { panel, updatePanel } = createEditorPanel(editorConfig);

          // Store reference for cleanup
          editorPanel = panel;

          // Add event listener for material updates
          generalEditor.sampleMaterialsUpdated.add(() => {
            updatePanel();
          });

          // Append panel to DOM
          document.body.append(panel);
          window.dispatchEvent(new Event("resize"));
        };

        /* MD
          ### 📥 Load Facility Fragment Data
        */

        // Fetch facility data and load the fragment file
        const loadFacilityFragment = async () => {
          try {
            const response = await fetch(`/api/facilities/${facilityId}`);
            if (!response.ok) {
              throw new Error("Failed to fetch facility data");
            }

            const data = await response.json();

            if (!data.fragmentPath) {
              alert(
                "No fragment file associated with this facility. Please upload one from the viewer page.",
              );
              return;
            }

            // Fetch fragment from volume API
            const fragmentResponse = await fetch(`/api/fragments/${facilityId}`);
            if (!fragmentResponse.ok) {
              throw new Error("Failed to fetch fragment from volume");
            }

            const buffer = await fragmentResponse.arrayBuffer();

            // Load edit history if available
            let historyBuffer: ArrayBuffer | undefined;
            if (data.editHistory) {
              historyBuffer = new Uint8Array(data.editHistory).buffer;
            }

            await loadModelAndInitializeEditor(
              buffer,
              data.ifcFileName || "facility_model",
              historyBuffer,
            );
            
            // Hide loading overlay after model is loaded
            setIsLoading(false);
          } catch (error) {
            console.error("Error loading facility fragment:", error);
            alert("Error loading the facility fragment file.");
            setIsLoading(false);
          }
        };

        // Initialize BUI Manager first
        BUI.Manager.init();

        // Load facility fragment data
        await loadFacilityFragment();

        console.log("BIM Editor initialized - loading facility model...");
      } catch (error) {
        console.error("Error initializing BIM Edit Example:", error);
      }
    };

    runExample();

    // Cleanup function - remove editor panel when component unmounts
    return () => {
      if (editorPanel && editorPanel.parentNode) {
        editorPanel.parentNode.removeChild(editorPanel);
      }
    };
  }, [facilityId]);

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-700 font-medium">Loading model...</p>
          </div>
        </div>
      )}
      <div id="container" style={{ width: "100vw", height: "100vh" }} />
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/icon?family=Material+Icons");

        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        .full-screen {
          width: 100vw;
          height: 100vh;
          position: relative;
          overflow: hidden;
        }

        /* Spatial panel styling for editor */
        .editor-controls-panel,
        .editor-properties-panel,
        .editor-history-panel {
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .editor-controls-panel .panel-content,
        .editor-properties-panel .panel-content,
        .editor-history-panel .panel-content {
          transition: all 0.2s ease-in-out;
        }

        .material-icons {
          font-family: "Material Icons";
          font-weight: normal;
          font-style: normal;
          font-size: 24px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          -webkit-font-feature-settings: "liga";
          -webkit-font-smoothing: antialiased;
        }

        @media (max-width: 480px) {
          .editor-controls-panel,
          .editor-properties-panel {
            position: static !important;
            max-width: none !important;
            margin: 1rem;
          }
        }
      `}</style>
    </>
  );
}
