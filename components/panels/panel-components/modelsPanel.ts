// import * as BUI from "@thatopen/ui";
// import * as CUI from "@thatopen/ui-obc";
// import * as OBC from "@thatopen/components";
// import { appIcons } from "@/components/globals";
// import * as WEBIFC from "web-ifc";
// import * as FRAGS from "@thatopen/fragments";

// export interface ConversionResult {
//   fragmentBytes: ArrayBuffer;
//   conversionTimeMs: number;
//   fileSizeInMB: number;
//   modelID: number;
// }

// let webIfc: WEBIFC.IfcAPI | null = null;
// let serializer: FRAGS.IfcImporter | null = null;
// let currentModelID: number | null = null;

// // Initialize WebIFC and serializer
// export const initWebIfc = async (): Promise<void> => {
//   webIfc = new WEBIFC.IfcAPI();
//   webIfc.SetWasmPath("https://unpkg.com/web-ifc@0.0.75/", true);
//   await webIfc.Init();

//   serializer = new FRAGS.IfcImporter();
//   serializer.wasm = {
//     absolute: true,
//     path: "https://unpkg.com/web-ifc@0.0.75/",
//   };
// };

// // Function to simulate progress for visual feedback
// export const simulateProgress = (
//   updateCallback: (progress: number) => void,
// ): number => {
//   // Progress should persist across interval calls
//   let progress = 0;
//   let lastProgressReported = -1;

//   return setInterval(() => {
//     // Simulate progress from 0-95% (leave 5% for final processing)
//     if (progress < 95) {
//       // Start slow, accelerate in middle, slow down at end for realistic effect
//       const increment = progress < 30 ? 1 : progress < 70 ? 2 : 0.5;
//       progress += increment;
//       progress = Math.min(progress, 95); // Cap at 95%

//       // Only update if progress has changed by at least 1%
//       const roundedProgress = Math.round(progress);
//       if (roundedProgress !== lastProgressReported) {
//         lastProgressReported = roundedProgress;
//         try {
//           updateCallback(roundedProgress);
//         } catch (error) {
//           console.warn("Error in progress callback:", error);
//           console.warn("Error type:", typeof error);
//           console.warn("Error constructor:", error?.constructor?.name);
//           if (error instanceof Error) {
//             console.warn("Error message:", error.message);
//             console.warn("Error stack:", error.stack);
//           }
//         }
//       }
//     }
//   }, 500) as unknown as number; // Increased interval to 500ms
// };

// // Convert IFC file to fragments
// export const convertIFC = async (
//   file?: File,
//   callbacks: {
//     onProgress?: (progress: number) => void;
//     onFinish?: () => void;
//   } = {},
// ): Promise<ConversionResult | null> => {
//   if (!webIfc || !serializer) {
//     await initWebIfc();
//   }

//   if (!webIfc || !serializer) {
//     throw new Error("Failed to initialize WebIFC");
//   }

//   let ifcBuffer: ArrayBuffer;
//   let fileName: string = "";
//   let fileSizeInMB: number = 0;
//   let fragmentBytes: ArrayBuffer;

//   // Start progress simulation if onProgress callback provided
//   let progressInterval: number | null = null;
//   if (callbacks.onProgress) {
//     progressInterval = simulateProgress((progress) => {
//       if (callbacks.onProgress) {
//         callbacks.onProgress(progress);
//       }
//     });
//   }

//   console.log("Starting IFC conversion process...");
//   const startTime = performance.now();

//   try {
//     if (file) {
//       // Use the uploaded file
//       ifcBuffer = await file.arrayBuffer();
//       fileName = file.name;
//       fileSizeInMB = Math.round((file.size / (1024 * 1024)) * 100) / 100;
//       console.log(`📁 File: ${fileName} (${fileSizeInMB} MB)`);
//     } else {
//       // Fallback to the original URL for backward compatibility
//       const url =
//         "https://thatopen.github.io/engine_components/resources/ifc/school_str.ifc";
//       fileName = "example.ifc";
//       const ifcFile = await fetch(url);
//       ifcBuffer = await ifcFile.arrayBuffer();
//       fileSizeInMB =
//         Math.round((ifcBuffer.byteLength / (1024 * 1024)) * 100) / 100;
//       console.log(`📁 File: ${fileName} (${fileSizeInMB} MB)`);
//     }

//     console.log("Processing IFC file...");
//     const ifcBytes = new Uint8Array(ifcBuffer);

//     // Load the model in web-ifc for JSON export
//     try {
//       // Close previous model if it exists
//       if (currentModelID !== null) {
//         try {
//           webIfc.CloseModel(currentModelID);
//         } catch (e) {
//           console.warn("Failed to close previous model:", e);
//         }
//       }

//       // Open the new model
//       currentModelID = webIfc.OpenModel(ifcBytes);
//       console.log(`IFC model loaded with ID: ${currentModelID}`);
//     } catch (e) {
//       console.error("Error loading IFC model into web-ifc:", e);
//       throw e;
//     }

//     // Convert the IFC bytes to fragments
//     const processInput = { bytes: ifcBytes };
//     // eslint-disable-next-line @typescript-eslint/no-explicit-any
//     const result = await serializer.process(processInput as any);
//     fragmentBytes =
//       result instanceof Uint8Array
//         ? (result.buffer as ArrayBuffer)
//         : (result as ArrayBuffer);

//     const endTime = performance.now();
//     const conversionTimeMs = Math.round(endTime - startTime);

//     console.log(`Conversion complete in ${conversionTimeMs / 1000} seconds`);
//     console.log(
//       `📊 Conversion rate: ${
//         Math.round((fileSizeInMB / (conversionTimeMs / 1000)) * 100) / 100
//       } MB/s`,
//     );

//     return {
//       fragmentBytes,
//       conversionTimeMs,
//       fileSizeInMB,
//       modelID: currentModelID,
//     };
//   } catch (error) {
//     console.error("Error converting IFC:", error);
//     return null;
//   } finally {
//     // Clear progress simulation
//     if (progressInterval) {
//       clearInterval(progressInterval);
//     }

//     // Set progress to 100% when done
//     if (callbacks.onProgress) {
//       try {
//         callbacks.onProgress(100);
//       } catch (error) {
//         console.warn("Error in final progress callback:", error);
//       }
//     }

//     // Call onFinish callback if provided
//     if (callbacks.onFinish) {
//       callbacks.onFinish();
//     }
//   }
// };

// // Get the current model ID
// export const getCurrentModelID = (): number | null => {
//   return currentModelID;
// };

// // Get the WebIFC instance
// export const getWebIfc = (): WEBIFC.IfcAPI | null => {
//   return webIfc;
// };

// export interface ModelsPanelState {
//   components: OBC.Components;
// }

// export interface ConversionProgress {
//   isConverting: boolean;
//   progress: number;
// }

// export const createModelsPanel = (
//   components: OBC.Components,
//   t: (key: string) => string,
// ) => {
//   const fragments = components.get(OBC.FragmentsManager);

//   console.log("Models panel created with fragments manager:", fragments);
//   console.log(
//     "Fragments manager initialized:",
//     fragments.core.models.list.size,
//     "models",
//   );

//   const [modelsList] = CUI.tables.modelsList({
//     components,
//     actions: { download: false },
//   });

//   const onAddIfcModel = async ({ target }: { target: BUI.Button }) => {
//     const input = document.createElement("input");
//     input.type = "file";
//     input.multiple = false;
//     input.accept = ".ifc";

//     input.addEventListener("change", async () => {
//       const file = input.files?.[0];
//       if (!file) return;
//       target.loading = true;

//       try {
//         // Use the new conversion approach
//         const conversionResult = await convertIFC(file, {
//           onProgress: (progress) => {
//             console.log(`Conversion progress: ${progress}%`);
//           },
//           onFinish: () => {
//             console.log("Conversion finished");
//           },
//         });

//         if (conversionResult) {
//           // Load the converted fragments
//           const modelName = file.name.replace(".ifc", "");
//           console.log("Loading fragments into scene...", {
//             fragmentsBytes: conversionResult.fragmentBytes.byteLength,
//             modelName,
//           });

//           const loadedFragments = await fragments.core.load(
//             conversionResult.fragmentBytes,
//             {
//               modelId: modelName,
//             },
//           );

//           console.log("Fragments loaded:", loadedFragments);
//           console.log(
//             "Total models in fragments manager:",
//             fragments.core.models.list.size,
//           );
//           console.log(`Model "${modelName}" loaded successfully`);

//           // Force update the fragments list
//           fragments.core.update(true);
//         } else {
//           console.error("Failed to convert IFC file");
//         }
//       } catch (error) {
//         console.error("Error processing IFC file:", error);
//       } finally {
//         target.loading = false;
//         BUI.ContextMenu.removeMenus();
//       }
//     });

//     input.addEventListener("cancel", () => (target.loading = false));

//     input.click();
//   };

//   const onAddFragmentsModel = async ({ target }: { target: BUI.Button }) => {
//     const input = document.createElement("input");
//     input.type = "file";
//     input.multiple = false;
//     input.accept = ".frag";

//     input.addEventListener("change", async () => {
//       const file = input.files?.[0];
//       if (!file) return;
//       target.loading = true;
//       const buffer = await file.arrayBuffer();
//       const bytes = new Uint8Array(buffer);
//       await fragments.core.load(bytes.buffer, {
//         modelId: file.name.replace(".frag", ""),
//       });
//       target.loading = false;
//       BUI.ContextMenu.removeMenus();
//     });

//     input.addEventListener("cancel", () => (target.loading = false));

//     input.click();
//   };

//   const onSearch = (e: Event) => {
//     const input = e.target as BUI.TextInput;
//     modelsList.queryString = input.value;
//   };

//   // const onDownloadFragments = async ({ target }: { target: BUI.Button }) => {
//   //   target.loading = true

//   //   try {
//   //     const models = Array.from(fragments.core.models.list.values())

//   //     if (models.length === 0) {
//   //       console.warn('No models available to download')
//   //       return
//   //     }

//   //     for (const model of models) {
//   //       try {
//   //         const fragsBuffer = await model.getBuffer(false)
//   //         const fileName = `model_${Date.now()}.frag`
//   //         const file = new File([fragsBuffer], fileName)

//   //         const link = document.createElement('a')
//   //         link.href = URL.createObjectURL(file)
//   //         link.download = file.name
//   //         link.click()

//   //         URL.revokeObjectURL(link.href)
//   //         console.log(`Downloaded: ${fileName}`)
//   //       } catch (error) {
//   //         console.error('Error downloading fragment:', error)
//   //       }
//   //     }
//   //   } catch (error) {
//   //     console.error('Error downloading fragments:', error)
//   //   } finally {
//   //     target.loading = false
//   //   }
//   // }

//   const onDownloadFragments = async ({ target }: { target: BUI.Button }) => {
//     target.loading = true;

//     try {
//       // Get all loaded models from fragments manager
//       const models = Array.from(fragments.core.models.list.values());

//       if (models.length === 0) {
//         console.warn("No models available to download");
//         return;
//       }

//       // Download each model as a separate fragment file
//       for (const model of models) {
//         try {
//           console.log(`Downloading fragments for model`);

//           // Get the fragment buffer from the model
//           const fragsBuffer = await model.getBuffer(false);

//           // Create a file with the fragment data
//           const fileName = `${"model"}.frag`;
//           const file = new File([fragsBuffer], fileName);

//           // Create download link and trigger download
//           const link = document.createElement("a");
//           link.href = URL.createObjectURL(file);
//           link.download = file.name;
//           link.click();

//           // Clean up the object URL
//           URL.revokeObjectURL(link.href);

//           console.log(`Downloaded: ${fileName}`);
//         } catch (error) {
//           console.error(`Error downloading fragments for model`, error);
//         }
//       }

//       console.log(`Downloaded ${models.length} fragment file(s)`);
//     } catch (error) {
//       console.error("Error downloading fragments:", error);
//     } finally {
//       target.loading = false;
//       BUI.ContextMenu.removeMenus();
//     }
//   };

//   return BUI.html`
//     <bim-panel-section fixed icon=${appIcons.MODEL} label=${t(
//       "models",
//     )} style="max-height: 400px; display: flex; flex-direction: column;">
//       <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
//         <bim-text-input @input=${onSearch} placeholder=${t(
//           "search",
//         )} debounce="200" style="flex: 1;"></bim-text-input>
//         <bim-button style="flex: 0;" icon=${appIcons.ADD}>
//           <bim-context-menu style="gap: 0.25rem;">
//             <bim-button label=${t("ifc")} @click=${onAddIfcModel}></bim-button>
//             <bim-button label=${t(
//               "fragments",
//             )} @click=${onAddFragmentsModel}></bim-button>
//           </bim-context-menu>
//         </bim-button>
//         <bim-button style="flex: 0;" icon="solar:download-bold" @click=${onDownloadFragments} label="Download"></bim-button>
//       </div>
//       <div style="flex: 1; overflow-y: auto; min-height: 0;">
//         ${modelsList}
//       </div>
//     </bim-panel-section>
//   `;
// };
