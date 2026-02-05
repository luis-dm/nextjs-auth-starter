import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import {
  enterFirstPersonMode,
  exitFirstPersonMode,
  isFirstPersonModeActive,
} from "@/utils/first-person-mode";
import React, { useState, useCallback, useEffect } from "react";
import {
  Ruler,
  Minimize2,
  Scissors,
  Ghost,
  Video,
  Focus,
  Maximize,
  Minimize,
  EyeOff,
  Eye,
} from "lucide-react";
import {
  dispatchVisibilityChanged,
  listenToVisibilityChanges,
  type VisibilityChangedDetail,
  dispatchIsolationChanged,
  listenToIsolationChanges,
  type IsolationChangedDetail,
} from "@/utils/visibility-events";

export interface ViewerToolbarState {
  components: OBC.Components;
  world: OBC.World;
  t: (key: string) => string;
  onNoteCreateRequest?: (
    position: { x: number; y: number; z: number },
    localId?: number,
  ) => void;
}

const originalColors = new Map<
  FRAGS.BIMMaterial,
  { color: number; transparent: boolean; opacity: number }
>();

const setModelTransparent = (components: OBC.Components) => {
  const fragments = components.get(OBC.FragmentsManager);

  const materials = [...fragments.core.models.materials.list.values()];
  for (const material of materials) {
    if (material.userData.customId) continue;
    let color: number | undefined;
    if ("color" in material) {
      color = material.color.getHex();
    } else {
      color = material.lodColor.getHex();
    }

    originalColors.set(material, {
      color,
      transparent: material.transparent,
      opacity: material.opacity,
    });

    material.transparent = true;
    material.opacity = 0.25;
    material.needsUpdate = true;
    if ("color" in material) {
      material.color.setColorName("white");
    } else {
      material.lodColor.setColorName("white");
    }
  }
};

const restoreModelMaterials = () => {
  for (const [material, data] of originalColors) {
    const { color, transparent, opacity } = data;
    material.transparent = transparent;
    material.opacity = opacity;
    if ("color" in material) {
      material.color.setHex(color);
    } else {
      material.lodColor.setHex(color);
    }
    material.needsUpdate = true;
  }
  originalColors.clear();
};

interface ToolbarPanelProps {
  components: OBC.Components;
  world: OBC.World;
}

export default function ToolbarPanel({ components, world }: ToolbarPanelProps) {
  // const t = useTranslations('Viewer');

  const [toolbarState, setToolbarState] = useState({
    hiddenSet: {} as OBC.ModelIdMap,
    isolatedSet: {} as OBC.ModelIdMap,
  });

  // Local state to trigger re-renders when global state changes
  const [updateTrigger, setUpdateTrigger] = useState(0);

  const [lengthEnabled, setLengthEnabled] = useState(false);
  const [areaEnabled, setAreaEnabled] = useState(false);
  const [sectionEnabled, setSectionEnabled] = useState(false);

  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  useEffect(() => {
    if (!world || !isTouchDevice) return;

    const isMeasuring = lengthEnabled || areaEnabled || sectionEnabled;

    if (world.camera && "controls" in world.camera) {
      const cameraControls = (world.camera as any).controls;
      if (cameraControls && "enabled" in cameraControls) {
        if (isMeasuring) {
          cameraControls.enabled = false;
        } else {
          cameraControls.enabled = true;
        }
      }
    }
  }, [world, isTouchDevice, lengthEnabled, areaEnabled, sectionEnabled]);

  useEffect(() => {
    if (!components || !world) return;

    const lengthMeasurer = components.get(OBF.LengthMeasurement);
    const areaMeasurer = components.get(OBF.AreaMeasurement);
    const clipper = components.get(OBC.Clipper);

    lengthMeasurer.world = world as any;
    areaMeasurer.world = world as any;
    if (!clipper.enabled) {
      clipper.enabled = false;
    }

    const cleanup = listenToVisibilityChanges(
      (detail: VisibilityChangedDetail) => {
        if (detail.source === "toolbar") return; // Ignore own events

        setToolbarState((prevState) => {
          const newHiddenSet = { ...prevState.hiddenSet };

          if (!detail.visible) {
            const fragments = components.get(OBC.FragmentsManager);
            for (const [modelId] of fragments.list) {
              if (!newHiddenSet[modelId]) {
                newHiddenSet[modelId] = new Set();
              }
              detail.elementIds.forEach((id) => {
                newHiddenSet[modelId].add(id);
              });
            }
          } else {
            for (const modelId in newHiddenSet) {
              detail.elementIds.forEach((id) => {
                newHiddenSet[modelId]?.delete(id);
              });
            }
          }

          return {
            ...prevState,
            hiddenSet: newHiddenSet,
          };
        });
      },
    );

    const cleanupIsolation = listenToIsolationChanges(
      (detail: IsolationChangedDetail) => {
        if (detail.source === "toolbar") return; // Ignore own events

        setToolbarState((prevState) => {
          if (detail.isIsolated) {
            // Add to isolated set
            const newIsolatedSet = { ...prevState.isolatedSet };
            for (const [modelId, elementSet] of Object.entries(
              detail.modelIdMap,
            )) {
              if (!newIsolatedSet[modelId]) {
                newIsolatedSet[modelId] = new Set();
              }
              elementSet.forEach((id) => {
                newIsolatedSet[modelId].add(id);
              });
            }
            return {
              ...prevState,
              isolatedSet: newIsolatedSet,
            };
          } else {
            // Unisolate - clear isolated set
            return {
              ...prevState,
              isolatedSet: {} as OBC.ModelIdMap,
            };
          }
        });
      },
    );

    return () => {
      cleanup();
      cleanupIsolation();
    };
  }, [components, world]);

  const applyVisibilityRules = useCallback(
    async (
      hider: OBC.Hider,
      hiddenSet?: OBC.ModelIdMap,
      isolatedSet?: OBC.ModelIdMap,
    ) => {
      const currentHiddenSet = hiddenSet || toolbarState.hiddenSet;
      const currentIsolatedSet = isolatedSet || toolbarState.isolatedSet;

      await hider.set(true);

      if (!OBC.ModelIdMapUtils.isEmpty(currentIsolatedSet)) {
        await hider.set(false);
        const itemsToShow = OBC.ModelIdMapUtils.clone(currentIsolatedSet);
        OBC.ModelIdMapUtils.remove(itemsToShow, currentHiddenSet);
        if (!OBC.ModelIdMapUtils.isEmpty(itemsToShow)) {
          await hider.set(true, itemsToShow);
        }
      } else {
        if (!OBC.ModelIdMapUtils.isEmpty(currentHiddenSet)) {
          await hider.set(false, currentHiddenSet);
        }
      }
    },
    [toolbarState.hiddenSet, toolbarState.isolatedSet],
  );

  const triggerUpdate = useCallback(() => {
    setUpdateTrigger((prev) => prev + 1);
  }, []);

  const disableAll = useCallback(
    (exceptions?: ("clipper" | "length" | "area")[]) => {
      if (!components) return;

      const highlighter = components.get(OBF.Highlighter);
      const lengthMeasurer = components.get(OBF.LengthMeasurement);
      const areaMeasurer = components.get(OBF.AreaMeasurement);
      const clipper = components.get(OBC.Clipper);

      highlighter.clear("select");
      highlighter.enabled = false;
      if (!exceptions?.includes("length")) {
        lengthMeasurer.enabled = false;
        setLengthEnabled(false);
      }
      if (!exceptions?.includes("area")) {
        areaMeasurer.enabled = false;
        setAreaEnabled(false);
      }
      if (!exceptions?.includes("clipper")) {
        clipper.enabled = false;
        setSectionEnabled(false);
      }
    },
    [components],
  );

  // Event handlers
  const onLength = useCallback(
    (event: React.MouseEvent) => {
      if (!components) return;

      const highlighter = components.get(OBF.Highlighter);
      const lengthMeasurer = components.get(OBF.LengthMeasurement);
      const button = event.currentTarget as HTMLElement;

      document.querySelectorAll(".toolbar-button").forEach((btn) => {
        const htmlBtn = btn as HTMLElement;
        const btnIcon = htmlBtn.querySelector(".material-icons") as HTMLElement;
        if (
          btnIcon &&
          (btnIcon.textContent === "straighten" ||
            btnIcon.textContent === "crop_free" ||
            btnIcon.textContent === "content_cut")
        ) {
          htmlBtn.classList.remove("active");
        }
      });

      const wasEnabled = lengthMeasurer.enabled;
      disableAll(["length"]);
      lengthMeasurer.enabled = !wasEnabled;
      setLengthEnabled(!wasEnabled);
      highlighter.enabled = !lengthMeasurer.enabled;

      if (!wasEnabled) {
        button.classList.add("active");
      }
    },
    [components, disableAll],
  );

  const onArea = useCallback(
    (event: React.MouseEvent) => {
      if (!components) return;

      const highlighter = components.get(OBF.Highlighter);
      const areaMeasurer = components.get(OBF.AreaMeasurement);
      const button = event.currentTarget as HTMLElement;

      document.querySelectorAll(".toolbar-button").forEach((btn) => {
        const htmlBtn = btn as HTMLElement;
        const btnIcon = htmlBtn.querySelector(".material-icons") as HTMLElement;
        if (
          btnIcon &&
          (btnIcon.textContent === "straighten" ||
            btnIcon.textContent === "crop_free" ||
            btnIcon.textContent === "content_cut")
        ) {
          htmlBtn.classList.remove("active");
        }
      });

      const wasEnabled = areaMeasurer.enabled;
      disableAll(["area"]);
      areaMeasurer.enabled = !wasEnabled;
      setAreaEnabled(!wasEnabled);
      highlighter.enabled = !areaMeasurer.enabled;

      if (!wasEnabled) {
        button.classList.add("active");
      }
    },
    [components, disableAll],
  );

  const onSection = useCallback(
    (event: React.MouseEvent) => {
      if (!components) return;

      const highlighter = components.get(OBF.Highlighter);
      const clipper = components.get(OBC.Clipper);
      const button = event.currentTarget as HTMLElement;

      document.querySelectorAll(".toolbar-button").forEach((btn) => {
        const htmlBtn = btn as HTMLElement;
        const btnIcon = htmlBtn.querySelector(".material-icons") as HTMLElement;
        if (
          btnIcon &&
          (btnIcon.textContent === "straighten" ||
            btnIcon.textContent === "crop_free" ||
            btnIcon.textContent === "content_cut")
        ) {
          htmlBtn.classList.remove("active");
        }
      });

      const wasEnabled = clipper.enabled;
      disableAll(["clipper"]);
      clipper.enabled = !wasEnabled;
      setSectionEnabled(!wasEnabled);
      highlighter.enabled = !clipper.enabled;

      if (!wasEnabled) {
        button.classList.add("active");
      }
    },
    [components, disableAll],
  );

  const onTransparency = useCallback(
    (event: React.MouseEvent) => {
      if (!components) return;

      const button = event.currentTarget as HTMLElement;
      const isCurrentlyTransparent = originalColors.size > 0;

      if (!isCurrentlyTransparent) {
        button.classList.add("active");
        setModelTransparent(components);
      } else {
        button.classList.remove("active");
        restoreModelMaterials();
      }
    },
    [components],
  );

  const onToggleFirstPerson = useCallback(async () => {
    if (!components || !world) return;

    if (isFirstPersonModeActive()) {
      await exitFirstPersonMode();
    } else {
      await enterFirstPersonMode({
        components,
        world: world as any,
      });
    }
  }, [components, world]);

  const onFocus = useCallback(
    async (event: React.MouseEvent) => {
      if (!components || !world) return;
      if (!(world.camera instanceof OBC.SimpleCamera)) return;

      const highlighter = components.get(OBF.Highlighter);
      const button = event.currentTarget as HTMLElement;
      const selection = highlighter.selection.select;
      button.classList.add("loading");
      await world.camera.fitToItems(
        OBC.ModelIdMapUtils.isEmpty(selection) ? undefined : selection,
      );
      button.classList.remove("loading");
    },
    [components, world],
  );

  const onHide = useCallback(
    async (event: React.MouseEvent) => {
      if (!components) return;

      const highlighter = components.get(OBF.Highlighter);
      const hider = components.get(OBC.Hider);
      const button = event.currentTarget as HTMLElement;
      const selection = highlighter.selection.select;
      if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
      button.classList.add("loading");

      const newHiddenSet = { ...toolbarState.hiddenSet };
      OBC.ModelIdMapUtils.add(newHiddenSet, selection);

      setToolbarState((prevState) => ({
        ...prevState,
        hiddenSet: newHiddenSet,
      }));

      await applyVisibilityRules(hider, newHiddenSet, toolbarState.isolatedSet);

      const elementIds: number[] = [];
      for (const [, elementSet] of Object.entries(selection)) {
        elementIds.push(...Array.from(elementSet));
      }

      dispatchVisibilityChanged({
        elementIds,
        visible: false,
        source: "toolbar",
      });

      button.classList.remove("loading");
      triggerUpdate();
    },
    [
      components,
      applyVisibilityRules,
      triggerUpdate,
      toolbarState.hiddenSet,
      toolbarState.isolatedSet,
    ],
  );

  const onIsolate = useCallback(
    async (event: React.MouseEvent) => {
      if (!components) return;

      const highlighter = components.get(OBF.Highlighter);
      const hider = components.get(OBC.Hider);
      const button = event.currentTarget as HTMLElement;
      const selection = highlighter.selection.select;
      if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
      button.classList.add("loading");

      const newIsolatedSet = { ...toolbarState.isolatedSet };
      OBC.ModelIdMapUtils.add(newIsolatedSet, selection);

      setToolbarState((prevState) => ({
        ...prevState,
        isolatedSet: newIsolatedSet,
      }));

      await applyVisibilityRules(hider, toolbarState.hiddenSet, newIsolatedSet);

      dispatchIsolationChanged({
        modelIdMap: selection,
        isIsolated: true,
        source: "toolbar",
      });

      button.classList.remove("loading");
      triggerUpdate();
    },
    [
      components,
      applyVisibilityRules,
      triggerUpdate,
      toolbarState.hiddenSet,
      toolbarState.isolatedSet,
    ],
  );

  const onShowAll = useCallback(
    async (event: React.MouseEvent) => {
      if (!components || !world) return;

      const highlighter = components.get(OBF.Highlighter);
      const hider = components.get(OBC.Hider);
      const button = event.currentTarget as HTMLElement;
      button.classList.add("loading");

      const elementIds: number[] = [];
      for (const [, elementSet] of Object.entries(toolbarState.hiddenSet)) {
        elementIds.push(...Array.from(elementSet));
      }

      const emptyHiddenSet = {} as OBC.ModelIdMap;
      const emptyIsolatedSet = {} as OBC.ModelIdMap;

      setToolbarState({
        hiddenSet: emptyHiddenSet,
        isolatedSet: emptyIsolatedSet,
      });

      await applyVisibilityRules(hider, emptyHiddenSet, emptyIsolatedSet);
      await highlighter.clear("select");

      for (const [styleName] of highlighter.styles) {
        if (styleName !== "select") {
          await highlighter.clear(styleName);
        }
      }

      if (world.camera instanceof OBC.SimpleCamera) {
        await world.camera.fitToItems(undefined);
      }

      if (elementIds.length > 0) {
        dispatchVisibilityChanged({
          elementIds,
          visible: true,
          source: "toolbar",
        });
      }

      button.classList.remove("loading");
      triggerUpdate();
    },
    [
      components,
      world,
      applyVisibilityRules,
      triggerUpdate,
      toolbarState.hiddenSet,
    ],
  );

  const onUnhide = useCallback(
    async (event: React.MouseEvent) => {
      if (!components) return;

      const hider = components.get(OBC.Hider);
      const button = event.currentTarget as HTMLElement;

      button.classList.add("loading");

      // Extract all previously hidden element IDs
      const elementIds: number[] = [];
      for (const [, elementSet] of Object.entries(toolbarState.hiddenSet)) {
        elementIds.push(...Array.from(elementSet));
      }

      const newHiddenSet = {} as OBC.ModelIdMap;

      setToolbarState((prevState) => ({
        ...prevState,
        hiddenSet: newHiddenSet,
      }));

      await applyVisibilityRules(hider, newHiddenSet, toolbarState.isolatedSet);

      dispatchVisibilityChanged({
        elementIds,
        visible: true,
        source: "toolbar",
      });

      button.classList.remove("loading");
      triggerUpdate();
    },
    [
      components,
      applyVisibilityRules,
      triggerUpdate,
      toolbarState.isolatedSet,
      toolbarState.hiddenSet,
    ],
  );

  const onUnisolate = useCallback(
    async (event: React.MouseEvent) => {
      if (!components) return;

      const hider = components.get(OBC.Hider);
      const button = event.currentTarget as HTMLElement;
      button.classList.add("loading");

      const emptyIsolatedSet = {} as OBC.ModelIdMap;

      setToolbarState((prevState) => ({
        ...prevState,
        isolatedSet: emptyIsolatedSet,
      }));

      await applyVisibilityRules(
        hider,
        toolbarState.hiddenSet,
        emptyIsolatedSet,
      );

      button.classList.remove("loading");
      triggerUpdate();
    },
    [components, applyVisibilityRules, triggerUpdate, toolbarState.hiddenSet],
  );

  if (!components || !world) {
    return null;
  }

  const shouldShowUnhide = !OBC.ModelIdMapUtils.isEmpty(toolbarState.hiddenSet);
  const shouldShowUnisolate = !OBC.ModelIdMapUtils.isEmpty(
    toolbarState.isolatedSet,
  );

  return (
    <div className="flex items-center justify-evenly p-3 bg-white border border-gray-200 shadow-sm rounded-lg w-full">
      {/* Length button */}
      <div
        className={`toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50 ${
          lengthEnabled ? "active" : ""
        }`}
        onClick={onLength}
        title={"length"}
      >
        <Ruler
          className={`w-5 h-5 mb-0.5 transition-colors duration-200 ease-in-out ${
            lengthEnabled ? "text-[#3870D5]" : "text-gray-600"
          }`}
        />
        <span
          className={`button-label text-[10px] font-medium text-center leading-tight transition-colors duration-200 ease-in-out ${
            lengthEnabled ? "text-[#3870D5]" : "text-gray-400"
          }`}
        >
          {"length"}
        </span>
      </div>

      {/* Area button */}
      <div
        className={`toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50 ${
          areaEnabled ? "active" : ""
        }`}
        onClick={onArea}
        title={"area"}
      >
        <Minimize2
          className={`w-5 h-5 mb-0.5 transition-colors duration-200 ease-in-out ${
            areaEnabled ? "text-[#3870D5]" : "text-gray-600"
          }`}
        />
        <span
          className={`button-label text-[10px] font-medium text-center leading-tight transition-colors duration-200 ease-in-out ${
            areaEnabled ? "text-[#3870D5]" : "text-gray-400"
          }`}
        >
          {"area"}
        </span>
      </div>

      {/* Section button */}
      <div
        className={`toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50 ${
          sectionEnabled ? "active" : ""
        }`}
        onClick={onSection}
        title={"section"}
      >
        <Scissors
          className={`w-5 h-5 mb-0.5 transition-colors duration-200 ease-in-out ${
            sectionEnabled ? "text-[#3870D5]" : "text-gray-600"
          }`}
        />
        <span
          className={`button-label text-[10px] font-medium text-center leading-tight transition-colors duration-200 ease-in-out ${
            sectionEnabled ? "text-[#3870D5]" : "text-gray-400"
          }`}
        >
          {"section"}
        </span>
      </div>

      {/* Transparency button */}
      <div
        className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
        onClick={onTransparency}
        title={"tooltip-ghost-transparent"}
      >
        <Ghost className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
        <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
          {"transparent"}
        </span>
      </div>

      {/* First Person button */}
      <div
        className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
        onClick={onToggleFirstPerson}
        title={"tooltip-first-person-nav"}
      >
        <Video className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
        <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
          {"first-person"}
        </span>
      </div>

      {/* Focus button (conditional) */}
      {world.camera instanceof OBC.SimpleCamera && (
        <div
          className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
          onClick={onFocus}
          title={"tooltip-focus-camera"}
        >
          <Focus className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
          <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
            {"focus"}
          </span>
        </div>
      )}

      {/* Isolate button */}
      <div
        className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
        onClick={onIsolate}
        title={"tooltip-isolate-selected"}
      >
        <Maximize className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
        <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
          {"isolate"}
        </span>
      </div>

      {/* Unisolate button (conditional) */}
      {shouldShowUnisolate && (
        <div
          className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
          onClick={onUnisolate}
          title={"tooltip-unisolate-elements"}
        >
          <Minimize className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
          <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
            {"unisolate"}
          </span>
        </div>
      )}

      {/* Hide button */}
      <div
        className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
        onClick={onHide}
        title={"tooltip-hide-selected"}
      >
        <EyeOff className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
        <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
          {"hide"}
        </span>
      </div>

      {/* Unhide button (conditional) */}
      {shouldShowUnhide && (
        <div
          className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
          onClick={onUnhide}
          title={"tooltip-unhide-elements"}
        >
          <Eye className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
          <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
            {"unhide"}
          </span>
        </div>
      )}

      {/* Show All button */}
      <div
        className="toolbar-button flex flex-col items-center py-2 px-3 cursor-pointer transition-all duration-200 ease-in-out min-w-[60px] select-none hover:border-gray-300 hover:bg-gray-50"
        onClick={onShowAll}
        title={"tooltip-show-all-visible"}
      >
        <Eye className="w-5 h-5 mb-0.5 text-gray-600 transition-colors duration-200 ease-in-out" />
        <span className="button-label text-[10px] font-medium text-gray-400 text-center leading-tight transition-colors duration-200 ease-in-out">
          {"reset-view"}
        </span>
      </div>
    </div>
  );
}
