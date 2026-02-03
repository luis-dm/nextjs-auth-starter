"use client";

import React from "react";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { spatialTreePanelTemplate } from "./panel-components/spatialPanel";
// import { chatbotPanelTemplate } from "./panel-components/chatbotPanel";
import ToolbarPanel from "./panel-components/TooolbarPanel";
import { createRoot } from "react-dom/client";

export function panelHandlers(
  components: OBC.Components,
  world: OBC.World,
  container: HTMLDivElement,
) {
  // Models panel removed - fragments loaded directly from facility data

  const spatialPanel = BUI.Component.create(() =>
    spatialTreePanelTemplate({ components, world }, () => ({
      components,
      world,
    })),
  );
  // const chatbotPanel = BUI.Component.create(() =>
  //   chatbotPanelTemplate({ components }, () => ({ components })),
  // );

  // Create a div element for the React toolbar component
  const toolbarContainer = document.createElement("div");
  const toolbarRoot = createRoot(toolbarContainer);
  toolbarRoot.render(React.createElement(ToolbarPanel, { components, world }));

  // Left panel wrapper - for spatial and chatbot panels
  const leftWrapper = document.createElement("div");
  leftWrapper.className = "sidebar";
  leftWrapper.style.position = "absolute";
  leftWrapper.style.top = "20px";
  leftWrapper.style.left = "20px";
  leftWrapper.style.zIndex = "1000";
  leftWrapper.style.width = "450px";
  leftWrapper.style.maxHeight = "calc(100% - 40px)";
  leftWrapper.style.overflowY = "auto";
  leftWrapper.style.gap = "0";
  leftWrapper.style.margin = "0";
  leftWrapper.style.padding = "0";

  // Toolbar wrapper - bottom center
  const toolbarWrapper = document.createElement("div");
  toolbarWrapper.style.position = "absolute";
  toolbarWrapper.style.bottom = "100px";
  toolbarWrapper.style.left = "50%";
  toolbarWrapper.style.transform = "translateX(-50%)";
  toolbarWrapper.style.zIndex = "10000";
  toolbarWrapper.style.width = "750px";

  toolbarWrapper.appendChild(toolbarContainer);

  // Create panel wrappers with dashboard-card styling
  const spatialWrapper = document.createElement("div");
  spatialWrapper.style.width = "350px";
  spatialWrapper.style.margin = "0";
  spatialWrapper.appendChild(spatialPanel);

  const chatbotWrapper = document.createElement("div");
  chatbotWrapper.style.width = "350px";
  chatbotWrapper.style.margin = "0";
  // chatbotWrapper.appendChild(chatbotPanel);

  if (container) {
    // Add main wrappers to container
    container.appendChild(leftWrapper);
    container.appendChild(toolbarWrapper);

    // Add panels to left wrapper
    leftWrapper.appendChild(spatialWrapper);
    leftWrapper.appendChild(chatbotWrapper);
  }
}
