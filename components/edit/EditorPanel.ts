import type { GeneralEditor, TableData } from "./GeneralEditor";

export interface EditorPanelConfig {
  generalEditor: GeneralEditor;
  exportModel: () => Promise<void>;
  BUI: any;
  fragments: any;
  model: any;
  FRAGS: any;
  updateHistoryContainer: () => Promise<void>;
  loadedHistoryData?: { requests: any[]; undoneRequests: any[] } | null;
}

export const createEditorPanel = (config: EditorPanelConfig) => {
  const {
    generalEditor,
    exportModel,
    BUI,
    fragments,
    model,
    FRAGS,
    updateHistoryContainer,
    loadedHistoryData,
  } = config;

  // Create the properties table and store reference to generalEditor
  const editor = generalEditor; // Create local reference
  const propertiesTable = document.createElement("bim-table") as any;
  propertiesTable.headersHidden = true;
  propertiesTable.expanded = true;
  propertiesTable.hiddenColumns = [
    "LocalId",
    "Type",
    "ParentLocalId",
    "ParentName",
  ];

  // Define how to display the table data
  propertiesTable.dataTransform = {
    Name: (value: any, row: Partial<TableData>) => {
      if (!row.Name || row.Name[0] === "_") {
        return "";
      }

      // For related elements (but not the root element), show delete button
      if (row.Type === "related" && row.ParentLocalId !== undefined) {
        return BUI.html`
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <bim-label>${value}</bim-label>
            <bim-button 
              icon="material-symbols:delete" 
              style="transform: scale(0.8);" 
              @click=${async () => {
                try {
                  await editor.deleteAttribute(
                    row.LocalId as number,
                    "element",
                  );
                } catch (error) {
                  console.error("Error deleting element:", error);
                }
              }}>
            </bim-button>
          </div>
        `;
      }

      return value;
    },
    Value: (value: any, row: Partial<TableData>) => {
      if (!row.Name || row.Name[0] === "_") {
        return "";
      }

      if (row.Type === "relation") {
        return value; // Show "X items" for relations
      }

      if (row.Type === "related") {
        return value; // Show the related item name (no input field)
      }

      // Only show input fields for actual attributes (not relations or related items)
      if (typeof value === "string") {
        return BUI.html`<bim-text-input 
          value=${value} 
          @input=${(e: any) => {
            try {
              editor.updateAttribute(row, e);
            } catch (error) {
              console.error("Error updating attribute:", error);
            }
          }}>
        </bim-text-input>`;
      }

      if (typeof value === "number") {
        return BUI.html`<bim-number-input 
          value=${value} 
          @change=${(e: any) => {
            try {
              editor.updateAttribute(row, e);
            } catch (error) {
              console.error("Error updating attribute:", error);
            }
          }}>
        </bim-number-input>`;
      }

      if (typeof value === "boolean") {
        return BUI.html`<bim-checkbox 
          ?checked=${value} 
          @change=${(e: any) => {
            try {
              editor.updateAttribute(row, e);
            } catch (error) {
              console.error("Error updating attribute:", error);
            }
          }}>
        </bim-checkbox>`;
      }

      return value;
    },
  };

  // Update properties table when data changes
  generalEditor.onPropertiesUpdated.add((data: any[]) => {
    propertiesTable.data = data;
    const propertiesContainer = document.getElementById("properties-container");
    if (propertiesContainer) {
      propertiesContainer.innerHTML = "";
      if (data.length > 0) {
        propertiesContainer.appendChild(propertiesTable);
        const applyButton = BUI.Component.create(() => {
          return BUI.html`
            <bim-button 
              label="Apply Property Changes" 
              @click=${async () => {
                try {
                  await editor.applyPropertyChanges();
                } catch (error) {
                  console.error("Error applying property changes:", error);
                }
              }}
              style="margin-top: 0.5rem;">
            </bim-button>
          `;
        });
        propertiesContainer.appendChild(applyButton);
      } else {
        propertiesContainer.innerHTML = `
          <div style="padding: 1rem; text-align: center; color: #6b7280; font-size: 0.875rem; background: white;">
            No element selected.<br>
            Double-click an element to view its properties.
          </div>
        `;
      }
    }
  });

  // Setup history container update
  let selectedRequestIndex: number | null = null;

  const updateHistoryContainerInternal = async () => {
    console.log("[HISTORY PANEL] updateHistoryContainerInternal called");
    const historyContainer = document.getElementById("history-container");
    if (!historyContainer) {
      console.log("[HISTORY PANEL] history-container element not found!");
      return;
    }

    try {
      // Get current edit requests from the editor
      // After applying loaded history on load, this already includes ALL edits
      console.log("[HISTORY PANEL] Getting model requests...");
      const { requests, undoneRequests } =
        await fragments.editor.getModelRequests(model.modelId);

      console.log(
        `[HISTORY PANEL] Got ${requests.length} requests, ${undoneRequests.length} undone`,
      );
      console.log("[HISTORY PANEL] Requests:", requests);

      const allRequests = [...requests, ...undoneRequests];

      historyContainer.innerHTML = "";

      if (allRequests.length === 0) {
        console.log("[HISTORY PANEL] No requests found - showing empty state");
        historyContainer.innerHTML = `
          <div style="padding: 1rem; text-align: center; color: #6b7280; font-size: 0.875rem;">
            No edit history yet.<br>
            Make changes to see edit history.
          </div>
        `;
        return;
      }

      console.log(
        `[HISTORY PANEL] Rendering ${allRequests.length} history items`,
      );

      for (let i = 0; i < allRequests.length; i++) {
        const request = allRequests[i];
        const nextExists = i < allRequests.length - 1;

        const requestButton = BUI.Component.create(() => {
          return BUI.html`
            <bim-button icon="solar:arrow-right-bold" style="flex: 0; min-width: 2rem;"></bim-button>
          `;
        });

        const isSelected = selectedRequestIndex === i;
        const noSelectionAndIsLast =
          selectedRequestIndex === null && !nextExists;
        if (isSelected || noSelectionAndIsLast) {
          requestButton.style.background = "#e5e7eb";
        }

        const currentIndex = i;
        requestButton.addEventListener("click", async () => {
          try {
            // Remove previous selection styling
            const prevSelected = historyContainer.querySelector(
              '[style*="background: #e5e7eb"]',
            ) as HTMLElement;
            if (prevSelected && prevSelected !== requestButton) {
              prevSelected.style.background = "";
            }

            // Mark current as selected
            requestButton.style.background = "#e5e7eb";

            await fragments.editor.selectRequest(model.modelId, currentIndex);
            await model.setVisible(undefined, true);
            selectedRequestIndex = currentIndex;
            await fragments.editor.edit(model.modelId, [], {
              removeRedo: false,
            });
            await fragments.update(true);
          } catch (error) {
            console.warn("Error selecting request:", error);
          }
        });

        const requestMenu = BUI.Component.create(() => {
          return BUI.html`
            <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid #e5e7eb; position: relative;">
              ${
                nextExists
                  ? BUI.html`<div style="position: absolute; left: 1rem; top: 2rem; width: 2px; height: 1rem; background: #d1d5db;"></div>`
                  : ""
              }
              ${requestButton}
              <div style="flex: 1;">
                <div style="font-size: 0.875rem; font-weight: 500; color: #374151;">
                  ${
                    FRAGS.EditRequestTypeNames
                      ? FRAGS.EditRequestTypeNames[request.type]
                      : request.type || "Edit"
                  }
                </div>
                <div style="font-size: 0.75rem; color: #6b7280;">
                  ID: ${request.localId}
                </div>
              </div>
            </div>
          `;
        });

        historyContainer.appendChild(requestMenu);
      }
    } catch (error) {
      console.warn("Error updating history container:", error);
      historyContainer.innerHTML = `
        <div style="padding: 1rem; text-align: center; color: #ef4444; font-size: 0.875rem;">
          Error loading history.<br>
          ${error instanceof Error ? error.message : "Unknown error"}
        </div>
      `;
    }
  };

  // Register history update with fragments editor
  fragments.editor.onEdit.add(updateHistoryContainerInternal);

  // Create main control panel with spatial panel styling
  const [panel, updatePanel] = BUI.Component.create((_: any) => {
    // Track collapsible panel states
    let isControlsExpanded = false;
    let isPropertiesExpanded = false;
    let isHistoryExpanded = false;

    const toggleControlsPanel = () => {
      isControlsExpanded = !isControlsExpanded;
      const controlsPanel = document.querySelector(".editor-controls-panel");
      if (controlsPanel) {
        const content = controlsPanel.querySelector(
          ".panel-content",
        ) as HTMLElement;
        const icon = controlsPanel.querySelector(".toggle-icon") as HTMLElement;

        if (content && icon) {
          content.style.display = isControlsExpanded ? "flex" : "none";
          icon.style.transform = isControlsExpanded
            ? "rotate(180deg)"
            : "rotate(0deg)";
        }
      }
    };

    const togglePropertiesPanel = () => {
      isPropertiesExpanded = !isPropertiesExpanded;
      const propertiesPanel = document.querySelector(
        ".editor-properties-panel",
      );
      if (propertiesPanel) {
        const content = propertiesPanel.querySelector(
          ".panel-content",
        ) as HTMLElement;
        const icon = propertiesPanel.querySelector(
          ".toggle-icon",
        ) as HTMLElement;

        if (content && icon) {
          content.style.display = isPropertiesExpanded ? "flex" : "none";
          icon.style.transform = isPropertiesExpanded
            ? "rotate(180deg)"
            : "rotate(0deg)";
        }
      }
    };

    const toggleHistoryPanel = () => {
      isHistoryExpanded = !isHistoryExpanded;
      const historyPanel = document.querySelector(".editor-history-panel");
      if (historyPanel) {
        const content = historyPanel.querySelector(
          ".panel-content",
        ) as HTMLElement;
        const icon = historyPanel.querySelector(".toggle-icon") as HTMLElement;

        if (content && icon) {
          content.style.display = isHistoryExpanded ? "flex" : "none";
          icon.style.transform = isHistoryExpanded
            ? "rotate(180deg)"
            : "rotate(0deg)";
        }
      }
    };

    const geometryButton = BUI.html`
      <bim-button 
        label="Change geometry" 
        @click=${() => {
          generalEditor.overrideGeometryWithCube();
        }}
        style="width: 100%;">
      </bim-button>
    `;

    // Get materials for materials section
    let materials: any[] = [];
    try {
      materials = generalEditor.get3dMaterials();
    } catch (error) {
      materials = [];
    }

    return BUI.html`
      <div style="position: fixed; top: 100px; right: 15px; width: 25rem; max-height: calc(100vh - 120px); display: flex; flex-direction: column; gap: 0; overflow-y: auto;">
        
        <!-- Controls Panel -->
        <div class="editor-controls-panel rounded-t-lg overflow-hidden mb-0 border border-gray-200 border-b-0 bg-white" style="width: 100%;">
          <!-- Collapsible Header -->
          <div @click=${toggleControlsPanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out">
            <span class="material-icons mr-2 text-xl text-gray-800">build</span>
            <span class="flex-1 text-sm font-medium text-gray-800">Element Editor</span>
            <span class="material-icons toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
          </div>
          
          <!-- Collapsible Content -->
          <div class="panel-content hidden flex-col" style="width: 100%;">
            <div class="p-4 space-y-3" style="width: 100%; box-sizing: border-box;">
              <bim-button 
                label="Save Model" 
                @click=${() => exportModel()}
                style="width: 100%;">
              </bim-button>
              
              <bim-button 
                data-name="arq" 
                label="Apply changes" 
                @click=${() => generalEditor.applyChanges()}
                style="width: 100%;">
              </bim-button>
              
              <bim-button 
                label="Clone Element" 
                icon="material-symbols:content-copy"
                @click=${async () => {
                  try {
                    if (generalEditor.elementSelected) {
                      await generalEditor.cloneElement();
                    } else {
                      console.warn("No element selected to clone");
                    }
                  } catch (error) {
                    console.error("Error cloning element:", error);
                  }
                }}
                style="width: 100%;">
              </bim-button>
              
              <bim-button 
                label="Delete Element" 
                icon="material-symbols:delete"
                @click=${async () => {
                  try {
                    if (generalEditor.elementSelected) {
                      await generalEditor.deleteElement();
                    } else {
                      console.warn("No element selected to delete");
                    }
                  } catch (error) {
                    console.error("Error deleting element:", error);
                  }
                }}
                style="width: 100%;">
              </bim-button>
              
              <bim-dropdown 
                required 
                label="Transform Mode" 
                @change="${({ target }: { target: any }) => {
                  const mode = target.value as "translate" | "rotate";
                  generalEditor.setControlsMode(mode);
                }}"
                style="width: 100%;">
                <bim-option checked label="translate"></bim-option>
                <bim-option label="rotate"></bim-option>
              </bim-dropdown>
              
              <bim-dropdown 
                required 
                label="Transform Target" 
                @change="${({ target }: { target: any }) => {
                  const targetType = target.value as "global" | "local";
                  generalEditor.setControlsTarget(targetType);
                }}"
                style="width: 100%;">
                <bim-option checked label="global"></bim-option>
                <bim-option label="local"></bim-option>
              </bim-dropdown>
              
              ${geometryButton}
            </div>
            
            <!-- Materials Section -->
            <div class="border-t border-gray-200 p-4" style="width: 100%; box-sizing: border-box;">
              <div class="flex items-center mb-3">
                <span class="material-icons mr-2 text-lg text-gray-800">palette</span>
                <span class="text-sm font-medium text-gray-800">Materials</span>
              </div>
              
              <div class="space-y-2" style="width: 100%;">
                ${
                  materials.length > 0
                    ? materials.map(
                        (material: any) =>
                          BUI.html`
                        <div style="display: flex; gap: 0.5rem; width: 100%;">
                          <bim-color-input 
                            color=#${material.color.getHexString()} 
                            label=${material.userData.localId} 
                            @input=${(e: any) => {
                              material.color.set(e.target.color);
                            }}
                            style="flex: 1;">
                          </bim-color-input>

                          <bim-number-input 
                            slider 
                            min=0 
                            max=1 
                            step=0.01 
                            value=${material.opacity} 
                            @change=${(e: any) => {
                              material.opacity = e.target.value;
                            }}
                            style="flex: 1;">
                          </bim-number-input>
                        </div>
                      `,
                      )
                    : BUI.html`
                      <div style="padding: 1rem; text-align: center; color: #6b7280; font-size: 0.875rem; width: 100%; box-sizing: border-box;">
                        No materials available.<br>
                        Select an element to edit materials.
                      </div>
                    `
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Properties Panel -->
        <div class="editor-properties-panel overflow-hidden border border-gray-200 border-b-0 bg-white" style="width: 100%;">
          <!-- Collapsible Header -->
          <div @click=${togglePropertiesPanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out">
            <span class="material-icons mr-2 text-xl text-gray-800">list_alt</span>
            <span class="flex-1 text-sm font-medium text-gray-800">Properties</span>
            <span class="material-icons toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
          </div>
          
          <!-- Collapsible Content -->
          <div class="panel-content hidden flex-col max-h-[400px]" style="width: 100%;">
            <div id="properties-container" class="flex-1 overflow-y-auto bg-white p-4" style="width: 100%; box-sizing: border-box;"></div>
          </div>
        </div>

        <!-- History Panel -->
        <div class="editor-history-panel rounded-b-lg overflow-hidden border border-gray-200 bg-white" style="width: 100%;">
          <!-- Collapsible Header -->
          <div @click=${toggleHistoryPanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out">
            <span class="material-icons mr-2 text-xl text-gray-800">history</span>
            <span class="flex-1 text-sm font-medium text-gray-800">Edit History</span>
            <span class="material-icons toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
          </div>
          
          <!-- Collapsible Content -->
          <div class="panel-content hidden flex-col max-h-[300px]" style="width: 100%;">
            <div id="history-container" class="flex-1 overflow-y-auto bg-white p-4" style="width: 100%; box-sizing: border-box;">
              <div style="padding: 1rem; text-align: center; color: #6b7280; font-size: 0.875rem;">
                Edit history will appear here after making changes.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }, {});

  // Listen for editor updates
  generalEditor.onUpdated.add(() => {
    updatePanel();
  });

  return {
    panel,
    updatePanel,
    updateHistoryContainer: updateHistoryContainerInternal,
  };
};
