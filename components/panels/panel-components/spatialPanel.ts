import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";

export interface SpatialTreePanelState {
  components: OBC.Components;
  world?: OBC.World;
}

interface ModelIdMap {
  [modelId: string]: Set<number>;
}

interface InputModelIdMap {
  [modelId: string]: number[] | Set<number>;
}

interface SpatialRowData {
  localId?: number;
  expressID?: number;
  Name?: string;
  children?: string;
  [key: string]: unknown;
}

export const spatialTreePanelTemplate: BUI.StatefullComponent<
  SpatialTreePanelState
> = (state) => {
  const { components, world } = state;

  const [spatialTree] = CUI.tables.spatialTree({
    components,
    models: [],
  });

  spatialTree.preserveStructureOnFilter = true;

  // Track visibility state locally for instant UI updates
  const elementVisibility = new Map<string | number, boolean>();

  // Track collapsible panel state
  let isExpanded = false;

  const togglePanel = () => {
    isExpanded = !isExpanded;
    // Force re-render to update the UI
    const panel = document.querySelector(".spatial-tree-panel");
    if (panel) {
      const content = panel.querySelector(".panel-content") as HTMLElement;
      const icon = panel.querySelector(".toggle-icon") as HTMLElement;

      if (content && icon) {
        content.style.display = isExpanded ? "flex" : "none";
        icon.style.transform = isExpanded ? "rotate(180deg)" : "rotate(0deg)";
      }
    }
  };

  // Helper function to expand selection with children
  const expandWithChildren = async (
    modelIdMap: InputModelIdMap,
  ): Promise<ModelIdMap> => {
    const expandedMap: ModelIdMap = {};

    for (const [modelId, elementSet] of Object.entries(modelIdMap)) {
      const elementIds = Array.isArray(elementSet)
        ? elementSet
        : elementSet instanceof Set
          ? Array.from(elementSet)
          : [];

      if (elementIds.length > 0) {
        console.log(
          `🔍 Expanding ${elementIds.length} elements with their children for model ${modelId}`,
        );

        try {
          // Get all children recursively using the same logic as the other function
          const expandedIds = await getAllElementsRecursively(
            elementIds,
            components,
          );
          expandedMap[modelId] = new Set(expandedIds);

          console.log(
            `Expanded to ${expandedIds.length} total elements (including children)`,
          );
        } catch (error) {
          console.warn(
            `Failed to expand children for model ${modelId}:`,
            error,
          );
          // Fallback to original elements if expansion fails
          expandedMap[modelId] =
            elementSet instanceof Set
              ? elementSet
              : new Set(Array.isArray(elementSet) ? elementSet : []);
        }
      } else {
        expandedMap[modelId] =
          elementSet instanceof Set
            ? elementSet
            : new Set(Array.isArray(elementSet) ? elementSet : []);
      }
    }

    return expandedMap;
  };

  // Helper function to get all elements recursively (matching bimchatbot.ts implementation)
  const getAllElementsRecursively = async (
    elementIds: number[],
    components: OBC.Components,
  ): Promise<number[]> => {
    const fragments = components.get(OBC.FragmentsManager);
    const allIds = new Set<number>(elementIds);

    for (const elementId of elementIds) {
      try {
        // Get the first available model for getting children
        for (const [modelId, model] of fragments.list) {
          try {
            const children = await model.getItemsChildren([elementId]);
            for (const childId of children) {
              if (!allIds.has(childId)) {
                allIds.add(childId);
                // Recursively get children of children
                const grandchildren = await getAllElementsRecursively(
                  [childId],
                  components,
                );
                grandchildren.forEach((id) => allIds.add(id));
              }
            }
            break; // Use the first model that works
          } catch (modelError) {
            console.warn(
              `Error getting children for element ${elementId} from model ${modelId}:`,
              modelError,
            );
            continue;
          }
        }
      } catch (error) {
        console.warn(`Error getting children for element ${elementId}:`, error);
      }
    }

    return Array.from(allIds);
  };

  // Add visibility toggle functionality
  const toggleVisibility = async (event: Event, rowData: SpatialRowData) => {
    event.stopPropagation();

    if (!world) return;

    try {
      const fragments = components.get(OBC.FragmentsManager);
      const hider = components.get(OBC.Hider);

      // Handle both individual elements and categories
      let elementIds: number[] = [];
      let toggleKey: string | number; // Key to track visibility state

      if (rowData.localId) {
        // Individual element
        elementIds = [rowData.localId];
        toggleKey = rowData.localId;
      } else if (rowData.children) {
        // Category with children - parse the children string
        try {
          const childrenStr = rowData.children.replace(/[\[\]]/g, ""); // Remove brackets
          elementIds = childrenStr
            .split(",")
            .map((id: string) => parseInt(id.trim()))
            .filter((id: number) => !isNaN(id));
          toggleKey = rowData.Name || "category"; // Use category name as key
        } catch (parseError) {
          console.warn("Failed to parse children:", parseError);
          return;
        }
      } else {
        console.warn("Row has neither localId nor children:", rowData);
        return;
      }

      console.log(
        `Toggling visibility for ${elementIds.length} elements:`,
        elementIds,
        rowData,
      );

      // Toggle visibility state immediately for instant UI feedback
      const currentVisibility = elementVisibility.get(toggleKey) ?? true;
      const newVisibility = !currentVisibility;
      elementVisibility.set(toggleKey, newVisibility);

      // Update button UI immediately without triggering re-render
      const button = event.target as HTMLElement;

      // Find the actual span element (in case we clicked on nested content)
      const actualIcon = button.classList.contains("material-icons")
        ? button
        : button.closest(".material-icons");

      if (actualIcon) {
        // Update the icon text content directly
        actualIcon.textContent = newVisibility
          ? "visibility"
          : "visibility_off";
        (actualIcon as HTMLElement).style.opacity = newVisibility ? "1" : "0.5";
      }

      // Create ModelIdMap for Hider (same pattern as toolbar)
      const modelIdMap: ModelIdMap = {};

      // Find which model contains these elements and create the map
      for (const [modelId] of fragments.list) {
        modelIdMap[modelId] = new Set(elementIds);
        break; // In single-model setup, just use the first model
      }

      if (Object.keys(modelIdMap).length > 0) {
        // Expand the selection to include children elements
        const expandedModelIdMap = await expandWithChildren(modelIdMap);

        if (newVisibility) {
          // Show element and its children - set(true, selection) shows elements
          await hider.set(true, expandedModelIdMap);
        } else {
          // Hide element and its children - set(false, selection) hides elements
          await hider.set(false, expandedModelIdMap);
        }

        // Update visibility state for all affected elements
        for (const [, elementSet] of Object.entries(expandedModelIdMap)) {
          const elements = Array.from(elementSet as Set<number>);
          elements.forEach((id) => {
            elementVisibility.set(id, newVisibility);
          });
        }

        // Also update the category key if this was a category toggle
        if (typeof toggleKey === "string") {
          elementVisibility.set(toggleKey, newVisibility);
        }
      }
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
    }
  };

  // Add data transform for visibility toggle
  spatialTree.dataTransform = {
    Name: (value: unknown, rowData: SpatialRowData) => {
      // Determine the toggle key and visibility state
      let toggleKey: string | number;
      let isVisible: boolean;

      if (rowData.localId) {
        // Individual element
        toggleKey = rowData.localId;
        isVisible = elementVisibility.get(toggleKey) ?? true;
      } else if (rowData.children) {
        // Category - use category name as key
        toggleKey = rowData.Name || "category";
        isVisible = elementVisibility.get(toggleKey) ?? true;
      } else {
        // Fallback
        toggleKey = rowData.Name || "unknown";
        isVisible = true;
      }

      const elementName = value || rowData.expressID || "Unnamed";

      // Show visibility icon for all elements (including IFC categories)
      return BUI.html`
        <div style="display: flex; align-items: center; width: 100%; position: relative;">
          <span style="
            font-size: 11px; 
            line-height: 1.2; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            white-space: nowrap;
            padding-right: 30px;
            cursor: pointer;
          ">${elementName}</span>
          <span 
            class="material-icons"
            style="
              font-family: 'Material Icons';
              font-size: 16px; 
              padding: 2px; 
              opacity: ${isVisible ? "1" : "0.5"};
              position: absolute;
              right: 4px;
              color: #1C1B1F;
              cursor: pointer;
              user-select: none;
              display: flex;
              align-items: center;
              justify-content: center;
            "
            @click=${(e: Event) => toggleVisibility(e, rowData)}
          >${isVisible ? "visibility" : "visibility_off"}</span>
        </div>
      `;
    },
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    spatialTree.queryString = input.value;
  };

  return BUI.html`
  <div class="spatial-tree-panel rounded-t-lg overflow-hidden mb-0 border border-gray-200 border-b-0 bg-white">
    <!-- Collapsible Header -->
    <div @click=${togglePanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out">
      <span class="material-icons mr-2 text-xl text-gray-800">account_tree</span>
      
      <span class="flex-1 text-sm font-medium text-gray-800">${"Spatial Tree"}</span>
      
      <span class="material-icons toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
    </div>
    
    <!-- Collapsible Content -->
    <div class="panel-content hidden flex-col max-h-[300px]">
      <textarea
        @input=${onSearch}
        placeholder=${"Search"}
        debounce="200"
        class="h-8 min-h-8 max-h-8 resize-none overflow-hidden flex-shrink-0 mx-4 mt-3 rounded bg-gray-50 border border-gray-200 px-3 py-2 text-sm font-sans outline-none box-border flex items-center"
        style="line-height: 1rem;"
      ></textarea>
      
      <div class="flex-1 overflow-y-auto min-h-0 mx-4 my-3">
        ${spatialTree}
      </div>
    </div>
  </div>
`;
};
