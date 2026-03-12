"use client";

import React, { useState, useEffect, useRef } from "react";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";

interface GraphPanelProps {
  isOpen: boolean;
  onClose: () => void;
  components: OBC.Components | undefined;
}

export function GraphPanel({ isOpen, onClose, components }: GraphPanelProps) {
  const pieChartRef = useRef<HTMLDivElement>(null);
  const [pieChart, setPieChart] = useState<BUI.Chart | null>(null);
  const updatePieRef = useRef<any>(null);

  // Initialize the charts
  useEffect(() => {
    if (!components) return;

    try {
      // Create attributes pie chart
      const [attrPieChart, updateAttrPie] = CUI.charts.attributesChart({
        type: "pie",
        addLabels: false,
        attribute: /empty/,
        category: /empty/,
        modelId: "",
        components,
      });

      attrPieChart.label = "Element Attributes Distribution";
      setPieChart(attrPieChart);
      updatePieRef.current = updateAttrPie;

      // Listen for fragment loading to populate chart
      const fragments = components.get(OBC.FragmentsManager);
      const onFragmentLoaded = async ({ value: model }: any) => {
        console.log(
          "GraphPanel: Fragment loaded, updating chart",
          model.modelId,
        );

        try {
          // Wait for model to be fully indexed
          await new Promise((resolve) => setTimeout(resolve, 500));

          console.log("GraphPanel: Updating pie chart with Name/COLUMN...");
          updateAttrPie({
            attribute: /^Name$/,
            category: /COLUMN/,
            modelId: model.modelId,
          });
        } catch (error) {
          console.error("GraphPanel: Error updating chart:", error);
        }
      };

      fragments.list.onItemSet.add(onFragmentLoaded);

      // Check if fragments are already loaded and populate chart
      if (fragments.list.size > 0) {
        console.log("GraphPanel: Fragments already loaded, populating chart");
        setTimeout(() => {
          const firstModel = Array.from(fragments.list.values())[0];
          if (firstModel) {
            console.log(
              "GraphPanel: Updating chart for model",
              firstModel.modelId,
            );
            updateAttrPie({
              attribute: /^Name$/,
              category: /COLUMN/,
              modelId: firstModel.modelId,
            });
          }
        }, 500);
      }

      // Cleanup
      return () => {
        fragments.list.onItemSet.remove(onFragmentLoaded);
      };
    } catch (error) {
      console.error("Error initializing graph panel:", error);
    }
  }, [components]);

  // Append the pie chart to its container when ready
  useEffect(() => {
    if (pieChart && pieChartRef.current) {
      pieChartRef.current.innerHTML = "";
      pieChartRef.current.appendChild(pieChart);
    }
  }, [pieChart]);

  const handleHighlight = () => {
    if (!pieChart) return;
    (pieChart as any).highlight((entry: any) => {
      if (!("value" in entry)) return false;
      return entry.value > 100;
    });
  };

  const handleFilter = () => {
    if (!pieChart) return;
    (pieChart as any).filterByValue((entry: any) => {
      if (!("value" in entry)) return false;
      return entry.value > 100;
    });
  };

  const handleReset = () => {
    if (!pieChart) return;
    (pieChart as any).reset();
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
              auto_graph
            </span>
            <h2 className="m-0 text-base font-normal text-[#1c1b1f] leading-8 flex items-center p-0">
              Element Analytics
            </h2>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 border-none bg-transparent rounded-md cursor-pointer text-[#1c1b1f] transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
          >
            <span className="material-icons text-[20px]">close</span>
          </button>
        </div>

        {/* Actions */}
        <div className="p-2.5 border-b border-gray-200 bg-[#f7f8fa] shrink-0">
          <div className="flex gap-2 items-center">
            <button
              className="flex-1 flex items-center justify-center h-9 border border-gray-200 bg-white rounded-lg cursor-pointer text-gray-700 text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300"
              onClick={handleHighlight}
            >
              Highlight
            </button>
            <button
              className="flex-1 flex items-center justify-center h-9 border border-gray-200 bg-white rounded-lg cursor-pointer text-gray-700 text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300"
              onClick={handleFilter}
            >
              Filter
            </button>
            <button
              className="flex-1 flex items-center justify-center h-9 border border-gray-200 bg-white rounded-lg cursor-pointer text-gray-700 text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Chart Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Element Attributes (Name - COLUMN)
              </h3>
              <div ref={pieChartRef} className="mb-6" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
