"use client";

import React, { useState, useEffect, useRef } from "react";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import {
  listenToVisibilityChanges,
  type VisibilityChangedDetail,
  listenToIsolationChanges,
  type IsolationChangedDetail,
} from "@/utils/visibility-events";
import { getTypeIndex } from "@/utils/ifcTypeIndexCache";
import { getTypeProperties } from "@/utils/ifcTypeIndex";

interface PropertiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  components: OBC.Components;
}

// Types for the properties table functionality
type ModelIdMap = Record<string, Set<number>>;

interface PropertiesTable extends HTMLElement {
  queryString: string | null;
  expanded: boolean;
  preserveStructureOnFilter: boolean;
  downloadData: (fileName?: string, format?: "json" | "tsv" | "csv") => void;
  tsv: string;
}

export function PropertiesPanel({
  isOpen,
  onClose,
  components,
}: PropertiesPanelProps) {
  const [propsTable, setPropsTable] = useState<PropertiesTable | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize the properties table
  useEffect(() => {
    if (!components) return;

    const highlighter = components.get(OBF.Highlighter);
    const fragments = components.get(OBC.FragmentsManager);

    const [table, updateTable] = CUI.tables.itemsData({
      components,
      modelIdMap: {},
    });

    table.preserveStructureOnFilter = true;

    // Store the original loadFunction
    const originalLoadFunction = table.loadFunction;

    // Override loadFunction to include type properties
    table.loadFunction = async () => {
      console.log("🔄 PropertiesPanel loadFunction called");

      // Call original loadFunction to get base properties
      const baseRows = (await originalLoadFunction?.()) || [];

      // Get current selection
      const selection = highlighter.selection.select;
      console.log("📍 Current selection:", {
        modelIds: Object.keys(selection),
        selectionCount: Object.keys(selection).length,
      });

      // Add type properties for each selected element
      for (const [modelId, localIds] of Object.entries(selection)) {
        console.log(`🔍 Processing model: "${modelId}" with ${Array.from(localIds).length} elements`);
        const model = fragments.list.get(modelId);
        if (!model) {
          console.warn("⚠️ Model not found for ID:", modelId);
          continue;
        }

        // Get cached type index for this model
        const typeIndex = getTypeIndex(modelId);
        if (!typeIndex) {
          console.warn("⚠️ No type index found in cache for model:", modelId);
          continue;
        }
        console.log("✅ Type index retrieved from cache for model:", modelId);

        // For each selected element, get its type properties
        for (const localId of localIds) {
          const typeProps = getTypeProperties(typeIndex, localId);

          if (typeProps.length > 0) {
            console.log(
              `📋 Found ${typeProps.length} type properties for element ${localId}`,
            );
          }

          // Add type properties to the rows
          for (const prop of typeProps) {
            baseRows.push({
              data: {
                Name: prop.Name,
                Value: prop.Value,
              },
            });
          }
        }
      }

      return baseRows;
    };

    setPropsTable(table);

    // Set up highlighter events
    const onHighlight = (modelIdMap: ModelIdMap) => {
      console.log("🎯 Highlighter onHighlight event:", {
        modelIds: Object.keys(modelIdMap),
        elementCounts: Object.entries(modelIdMap).map(([id, set]) => ({
          modelId: id,
          count: set.size,
        })),
      });
      updateTable({ modelIdMap });
    };

    const onClear = () => {
      console.log("🧹 Highlighter onClear event");
      updateTable({ modelIdMap: {} });
    };

    highlighter.events.select.onHighlight.add(onHighlight);
    highlighter.events.select.onClear.add(onClear);

    return () => {
      highlighter.events.select.onHighlight.remove(onHighlight);
      highlighter.events.select.onClear.remove(onClear);
    };
  }, [components]);

  // Append the properties table to the container when it's available
  useEffect(() => {
    if (propsTable && containerRef.current) {
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(propsTable);
    }
  }, [propsTable]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (propsTable) {
      propsTable.queryString = value;
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    if (propsTable) {
      propsTable.queryString = "";
    }
  };

  const handleToggleExpanded = () => {
    if (propsTable) {
      propsTable.expanded = !propsTable.expanded;
    }
  };

  const handleExport = () => {
    if (propsTable) {
      // Log the TSV data directly (like in the example)
      console.log("Properties Table TSV:", propsTable.tsv);

      propsTable.downloadData("ElementData", "tsv");
    }
  };

  return (
    <>
      {/* Panel */}
      <div
        className={`absolute top-0 right-0 w-[30%] h-full bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.15)] z-10 flex flex-col transition-all duration-300 cubic-bezier(0.4,0,0.2,1) ${
          isOpen
            ? "transform translate-x-0 pointer-events-auto visible"
            : "transform translate-x-full pointer-events-none invisible"
        } max-lg:w-[40%] max-md:w-[60%] max-sm:w-[85%]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-[10px_24px] border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-icons text-[32px] text-[#1c1b1f]">
              home_repair_service
            </span>
            <h2 className="m-0 text-base font-normal text-[#1c1b1f] leading-8 flex items-center p-0">
              Selection Data
            </h2>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 border-none bg-transparent rounded-md cursor-pointer text-[#1c1b1f] transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
          >
            <span className="material-icons text-[20px]">close</span>
          </button>
        </div>

        {/* Search and Controls */}
        <div className="p-2.5 border-b border-gray-200 bg-[#f7f8fa] shrink-0">
          <div className="flex gap-2 items-center">
            <div className="relative flex items-center flex-1">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={handleSearch}
                className="w-full py-1.5 pl-4 pr-20 border border-gray-200 rounded-3xl text-sm text-gray-800 bg-white transition-colors duration-200 ease-in-out placeholder:text-gray-400 focus:outline-none focus:border-gray-800"
              />
              <button
                className="absolute right-3 bg-none border-none text-lg text-gray-500 cursor-pointer rounded flex items-center justify-center w-6 h-6 hover:text-gray-700"
                onClick={handleClearSearch}
              >
                <span className="material-icons text-lg">close</span>
              </button>
            </div>
            <button
              className="flex items-center justify-center w-9 h-9 border border-gray-200 bg-white rounded-[20px] cursor-pointer text-gray-500 transition-all duration-200 ease-in-out shrink-0 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700"
              onClick={handleToggleExpanded}
              title="Collapse"
            >
              <span className="material-icons text-lg">unfold_more</span>
            </button>
            <button
              className="flex items-center justify-center w-9 h-9 border border-gray-200 bg-white rounded-[20px] cursor-pointer text-gray-500 transition-all duration-200 ease-in-out shrink-0 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700"
              onClick={handleExport}
              title="Export Data"
            >
              <span className="material-icons text-lg">download</span>
            </button>
          </div>
        </div>

        {/* Properties Table Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div ref={containerRef} className="flex-1 overflow-y-auto p-4" />
        </div>
      </div>
    </>
  );
}
