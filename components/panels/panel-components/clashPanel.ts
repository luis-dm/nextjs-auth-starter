import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

export interface ClashPanelState {
  components: OBC.Components;
}

export interface ClashResult {
  id: string;
  elementA: {
    modelId: string;
    id: string;
    name?: string;
  };
  elementB: {
    modelId: string;
    id: string;
    name?: string;
  };
  distance: number;
  position: { x: number; y: number; z: number };
}

// Simple module-level state
let isRunning = false;
let clashResults: ClashResult[] = [];
let tolerance = 0.01; // 1cm default

const updateClashResults = () => {
  const resultsContainer = document.querySelector(".clash-results-container");
  if (!resultsContainer) return;

  if (clashResults.length === 0) {
    resultsContainer.innerHTML = `
      <div class="p-4 text-center text-gray-500 text-sm">
        No clashes detected. Click "Run Detection" to analyze models.
      </div>
    `;
  } else {
    resultsContainer.innerHTML = clashResults
      .map(
        (clash, index) => `
        <div class="p-3 mb-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium text-gray-500">Clash #${index + 1}</span>
            <span class="text-xs font-bold ${
              clash.distance > 0.05 ? "text-red-600" : "text-orange-500"
            }">
              ${(clash.distance * 1000).toFixed(1)}mm
            </span>
          </div>
          <div class="text-xs text-gray-600 space-y-1">
            <div class="flex items-start">
              <span class="font-medium mr-1">A:</span>
              <span class="flex-1">${clash.elementA.name || clash.elementA.id}</span>
            </div>
            <div class="flex items-start">
              <span class="font-medium mr-1">B:</span>
              <span class="flex-1">${clash.elementB.name || clash.elementB.id}</span>
            </div>
          </div>
        </div>
      `,
      )
      .join("");
  }
};

const updateRunButton = () => {
  const button = document.querySelector(
    ".clash-run-button",
  ) as HTMLButtonElement;
  if (button) {
    button.disabled = isRunning;
    button.textContent = isRunning ? "Running..." : "Run Detection";
  }
};

const updateProgressBar = () => {
  const progressBar = document.querySelector(".clash-progress-bar");
  if (progressBar && isRunning) {
    (progressBar as HTMLElement).style.display = "block";
  } else if (progressBar) {
    (progressBar as HTMLElement).style.display = "none";
  }
};

export const createClashPanel = (
  components: OBC.Components,
  t: (key: string) => string,
) => {
  const fragments = components.get(OBC.FragmentsManager);

  // Track collapsible panel state
  let isClashExpanded = false;

  const toggleClashPanel = () => {
    isClashExpanded = !isClashExpanded;
    const panel = document.querySelector(".clash-panel");
    if (panel) {
      const content = panel.querySelector(".clash-panel-content") as HTMLElement;
      const icon = panel.querySelector(".clash-toggle-icon") as HTMLElement;

      if (content && icon) {
        content.style.display = isClashExpanded ? "flex" : "none";
        icon.style.transform = isClashExpanded
          ? "rotate(180deg)"
          : "rotate(0deg)";
      }
    }
  };

  const handleRunDetection = async () => {
    if (isRunning) return;

    isRunning = true;
    updateRunButton();
    updateProgressBar();

    // Clear previous results
    clashResults = [];
    updateClashResults();

    try {
      console.log("Running clash detection with tolerance:", tolerance);

      // Get all loaded models
      const models = Array.from(fragments.list.values());
      console.log(`Analyzing ${models.length} models for clashes...`);

      if (models.length < 2) {
        alert("At least 2 models are required for clash detection");
        return;
      }

      // Simulate clash detection for now
      // TODO: Implement actual BVH-based clash detection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock results for demonstration
      clashResults = [
        {
          id: "clash-1",
          elementA: {
            modelId: "model-1",
            id: "element-123",
            name: "Wall - 200mm Exterior",
          },
          elementB: {
            modelId: "model-2",
            id: "element-456",
            name: "Beam - 300x600mm",
          },
          distance: 0.045,
          position: { x: 10.5, y: 3.2, z: 0.0 },
        },
        {
          id: "clash-2",
          elementA: {
            modelId: "model-1",
            id: "element-789",
            name: "Column - 400x400mm",
          },
          elementB: {
            modelId: "model-2",
            id: "element-012",
            name: "Duct - Ø300mm",
          },
          distance: 0.092,
          position: { x: 5.2, y: 2.8, z: 3.5 },
        },
      ];

      updateClashResults();
      console.log(`Found ${clashResults.length} clashes`);
    } catch (error) {
      console.error("Error running clash detection:", error);
      alert("Failed to run clash detection");
    } finally {
      isRunning = false;
      updateRunButton();
      updateProgressBar();
    }
  };

  const handleToleranceChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    tolerance = parseFloat(input.value) / 1000; // Convert mm to m
    console.log("Tolerance changed to:", tolerance, "m");
  };

  // Initialize UI after render
  setTimeout(() => {
    updateClashResults();
    updateRunButton();
  }, 100);

  return BUI.html`
    <div class="clash-panel overflow-hidden mb-0 border border-gray-200 rounded-lg">
      <!-- Collapsible Header -->
      <div @click=${toggleClashPanel} class="flex items-center p-3 bg-white border-b border-gray-200 cursor-pointer select-none transition-colors duration-200 ease-in-out hover:bg-gray-50 rounded-t-lg">
        <span class="material-icons mr-2 text-xl text-gray-800">shield</span>
        <span class="flex-1 text-sm font-medium text-gray-800">Clash Detection</span>
        <span class="material-icons clash-toggle-icon text-xl text-gray-800 transition-transform duration-200 ease-in-out">keyboard_arrow_down</span>
      </div>

      <!-- Collapsible Content -->
      <div class="clash-panel-content hidden flex-col max-h-[500px] bg-white rounded-b-lg">
        <div class="p-3 flex flex-col gap-3">
          
          <!-- Settings Section -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-gray-700">Tolerance (mm)</label>
              <input 
                type="number" 
                value="10" 
                min="1" 
                max="100" 
                step="1"
                @change=${handleToleranceChange}
                class="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-gray-800"
              />
            </div>
          </div>

          <!-- Run Button -->
          <button 
            @click=${handleRunDetection}
            class="clash-run-button w-full px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Run Detection
          </button>

          <!-- Progress Bar -->
          <div class="clash-progress-bar hidden w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div class="h-full bg-gray-800 animate-pulse" style="width: 100%"></div>
          </div>

          <!-- Results Section -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-gray-700">Results</span>
              <span class="text-xs text-gray-500">${clashResults.length} clashes</span>
            </div>
            
            <div class="clash-results-container overflow-y-auto max-h-[300px] border border-gray-200 rounded-lg bg-white">
              <!-- Results will be populated dynamically -->
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
};
