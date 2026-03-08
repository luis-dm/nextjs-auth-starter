import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { appIcons } from "@/components/globals";

let currentModelID: number | null = null;

// Get the current model ID
export const getCurrentModelID = (): number | null => {
  return currentModelID;
};

export interface ModelsPanelState {
  components: OBC.Components;
}

export interface ConversionProgress {
  isConverting: boolean;
  progress: number;
}

export const createModelsPanel = (
  components: OBC.Components,
  t: (key: string) => string,
) => {
  const fragments = components.get(OBC.FragmentsManager);

  console.log("Models panel created with fragments manager:", fragments);
  console.log(
    "Fragments manager initialized:",
    fragments.core.models.list.size,
    "models",
  );

  const [modelsList] = CUI.tables.modelsList({
    components,
    actions: { download: false },
  });

  // Track collapsible panel state
  let isModelsExpanded = false;

  const toggleModelsPanel = () => {
    isModelsExpanded = !isModelsExpanded;
    // Force re-render to update the UI
    const panel = document.querySelector(".models-panel");
    if (panel) {
      const content = panel.querySelector(
        ".models-panel-content",
      ) as HTMLElement;
      const icon = panel.querySelector(".models-toggle-icon") as HTMLElement;

      if (content && icon) {
        content.style.display = isModelsExpanded ? "flex" : "none";
        icon.style.transform = isModelsExpanded
          ? "rotate(180deg)"
          : "rotate(0deg)";
      }
    }
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };

  return BUI.html`
    <div class="models-panel overflow-hidden mb-0 border border-gray-200 rounded-lg">
      <!-- Collapsible Header -->
      <div @click=${toggleModelsPanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out hover:bg-gray-50 rounded-t-lg">
        <span class="material-icons mr-2 text-xl text-gray-800">view_in_ar</span>
        <span class="flex-1 text-sm font-medium text-gray-800">Models</span>
        <span class="material-icons models-toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
      </div>

      <!-- Collapsible Content -->
      <div class="models-panel-content hidden flex-col max-h-[400px] bg-white rounded-b-lg">
        <div class="p-3 flex flex-col gap-2">
          <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
            <bim-text-input @input=${onSearch} placeholder=${t(
              "search",
            )} debounce="200" style="flex: 1;"></bim-text-input>
          </div>
          <div style="flex: 1; overflow-y: auto; min-height: 0; max-height: 300px;">
            ${modelsList}
          </div>
        </div>
      </div>
    </div>
  `;
};
