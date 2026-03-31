import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { dispatchVisibilityChanged } from "@/utils/visibility-events";

interface IFCNode {
  name?: string;
  localId?: number;
  children?: IFCNode[];
  properties?: Record<string, unknown>;
}

export class BimChatbot {
  private components: OBC.Components;
  private fragments: OBC.FragmentsManager;
  private spatialStructure: IFCNode | null = null;
  private enhancedStructure: any = null;
  private isFilesystemReady: boolean = false;
  private threadId: string | null = null;

  constructor(components: OBC.Components) {
    this.components = components;
    this.fragments = components.get(OBC.FragmentsManager);
  }

  private async refreshViewer(): Promise<void> {
    try {
      await this.fragments.core.update(true);
    } catch (error) {
      console.warn("Failed to refresh viewer after chatbot action:", error);
    }
  }

  async selectElements(elementIds: number[]): Promise<void> {
    try {
      console.log("BimChatbot.selectElements called with:", elementIds);
      const highlighter = this.components.get(OBF.Highlighter);
      const fragments = this.components.get(OBC.FragmentsManager);

      console.log("Fragments list size:", fragments.list.size);

      // Clear previous selection
      await highlighter.clear("select");
      console.log("Cleared previous selection");

      // Build ModelIdMap for selection
      const selection: OBC.ModelIdMap = {};

      for (const [modelId] of fragments.list) {
        selection[modelId] = new Set(elementIds);
        console.log(`Added ${elementIds.length} elements to model ${modelId}`);
      }

      console.log("Selection map:", selection);

      // Apply selection
      await highlighter.highlightByID("select", selection);
      await this.refreshViewer();

      console.log(`Selected ${elementIds.length} elements`);
    } catch (error) {
      console.error("Error selecting elements:", error);
      throw error;
    }
  }
  async hideElements(elementIds: number[]): Promise<void> {
    try {
      const hider = this.components.get(OBC.Hider);
      const fragments = this.components.get(OBC.FragmentsManager);

      // Build ModelIdMap for hiding
      const toHide: OBC.ModelIdMap = {};

      for (const [modelId] of fragments.list) {
        toHide[modelId] = new Set(elementIds);
      }

      // Apply hiding
      await hider.set(false, toHide);
      await this.refreshViewer();

      // Dispatch visibility changed event
      dispatchVisibilityChanged({
        elementIds,
        visible: false,
        source: "chatbot",
      });

      console.log(`Hid ${elementIds.length} elements`);
    } catch (error) {
      console.error("Error hiding elements:", error);
      throw error;
    }
  }

  async showElements(elementIds: number[]): Promise<void> {
    try {
      const hider = this.components.get(OBC.Hider);
      const fragments = this.components.get(OBC.FragmentsManager);

      // Build ModelIdMap for showing
      const toShow: OBC.ModelIdMap = {};

      for (const [modelId] of fragments.list) {
        toShow[modelId] = new Set(elementIds);
      }

      // Apply showing
      await hider.set(true, toShow);
      await this.refreshViewer();

      // Dispatch visibility changed event
      dispatchVisibilityChanged({
        elementIds,
        visible: true,
        source: "chatbot",
      });

      console.log(`Showed ${elementIds.length} elements`);
    } catch (error) {
      console.error("Error showing elements:", error);
      throw error;
    }
  }

  async isolateElements(elementIds: number[]): Promise<void> {
    try {
      const hider = this.components.get(OBC.Hider);
      const fragments = this.components.get(OBC.FragmentsManager);

      // Build ModelIdMap for isolating
      const toIsolate: OBC.ModelIdMap = {};

      for (const [modelId] of fragments.list) {
        toIsolate[modelId] = new Set(elementIds);
      }

      // Apply isolation: hide everything first, then show only selected
      await hider.set(false); // Hide all
      await hider.set(true, toIsolate); // Show only isolated elements
      await this.refreshViewer();

      console.log(`Isolated ${elementIds.length} elements`);
    } catch (error) {
      console.error("Error isolating elements:", error);
      throw error;
    }
  }

  private async enhanceSpatialStructureWithProperties(
    node: IFCNode,
  ): Promise<any> {
    // If this node has a localId, extract detailed properties similar to generatePropertiesTSV
    if (node.localId && typeof node.localId === "number") {
      try {
        const model = Array.from(this.fragments.list.values())[0];
        if (model && model.getItemsData) {
          // Get bounding box for this element
          try {
            const boxes = await model.getBoxes([node.localId]);
            if (boxes && boxes.length > 0) {
              const box = boxes[0];
              (node as any).bbox = {
                min: { x: box.min.x, y: box.min.y, z: box.min.z },
                max: { x: box.max.x, y: box.max.y, z: box.max.z },
              };
            }
          } catch (bboxError) {
            console.warn(
              `Failed to get bounding box for element ${node.localId}:`,
              bboxError,
            );
          }

          // Get properties for this element using the same pattern as generatePropertiesTSV
          const itemsData = await model.getItemsData([node.localId], {
            attributesDefault: true,
            attributes: [],
            relations: {
              ContainedInStructure: { attributes: true, relations: false },
            },
          });

          if (itemsData && itemsData.length > 0) {
            const elementData = itemsData[0];
            const properties: Record<string, unknown> = {};

            // Extract all properties using the same logic as generatePropertiesTSV
            for (const [key, value] of Object.entries(elementData as any)) {
              // Skip the IsDefinedBy relation as we'll handle it separately
              if (key === "IsDefinedBy") continue;

              // Skip internal properties and less useful fields
              if (key === "_guid" || key === "Tag") continue;

              const isContainedInStrucutre =
                key === "ContainedInStructure" &&
                value &&
                typeof value === "object";

              // Handle special objects like ContainedInStructure
              if (isContainedInStrucutre) {
                // ContainedInStructure is an array of structure objects
                if (Array.isArray(value)) {
                  const structureNames: string[] = [];
                  for (let i = 0; i < value.length; i++) {
                    const structureObj = value[i] as any;

                    // Only extract the name, ignore type and long name
                    if (structureObj.Name?.value) {
                      structureNames.push(structureObj.Name.value);
                    }
                  }
                  if (structureNames.length > 0) {
                    // If multiple structures, join them; if single, just use the name
                    properties.ContainedInStructure =
                      structureNames.length === 1
                        ? structureNames[0]
                        : structureNames.join(", ");
                  }
                } else {
                  // For non-array structure objects, try to extract just the name
                  const structureObj = value as any;
                  if (structureObj.Name?.value) {
                    properties.ContainedInStructure = structureObj.Name.value;
                  }
                }
                continue;
              }

              // Extract the actual value if it's in the standard IFC format
              let displayValue: unknown = value;

              const isValueInStandardIFCFormat =
                value && typeof value === "object" && "value" in value;

              if (isValueInStandardIFCFormat) {
                displayValue = (value as any).value;
              } else if (value && typeof value === "object") {
                // For other objects, show a more useful representation
                const objectKeys = Object.keys(value);
                if (objectKeys.length <= 3) {
                  // Small objects, include full details
                  displayValue = JSON.stringify(value);
                } else {
                  // Large objects, just note the structure
                  displayValue = `[Object with keys: ${objectKeys.join(", ")}]`;
                }
              }

              // Only include meaningful properties (same logic as generatePropertiesTSV)
              const isDisplayValueEmpty =
                displayValue === null ||
                displayValue === undefined ||
                displayValue === "";

              if (!isDisplayValueEmpty) {
                properties[key] = displayValue;
              }
            }

            // Add properties to the enhanced node
            if (Object.keys(properties).length > 0) {
              node.properties = properties;

              // Log some key properties for debugging
              const keyProps = [
                "Name",
                "ObjectType",
                "Material",
                "Length",
                "Width",
                "Height",
              ];
              const foundProps = keyProps.filter((prop) => properties[prop]);
              if (foundProps.length > 0) {
                // debug logging preserved but not essential for runtime
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          `Failed to extract properties for element ${node.localId}:`,
          error,
        );
      }
    }

    // Recursively enhance children
    if (node.children && Array.isArray(node.children)) {
      // Preserve original children while replacing the node.children array
      const originalChildren = node.children;
      node.children = [];
      for (const child of originalChildren) {
        const enhancedChild =
          await this.enhanceSpatialStructureWithProperties(child);
        if (enhancedChild) {
          node.children.push(enhancedChild);
        }
      }
    }

    return node;
  }

  private async loadSpatialStructure(): Promise<void> {
    try {
      const models = Array.from(this.fragments.list.values());

      if (models.length === 0) {
        console.warn("No models loaded in fragments");
        this.spatialStructure = {} as IFCNode;
        return;
      }

      const model = models[0];
      console.log("Loading spatial structure from model");

      // Get the spatial structure tree from the model
      const spatialTree = await model.getSpatialStructure();
      console.log("Spatial tree loaded successfully");
      this.spatialStructure = spatialTree as IFCNode;
    } catch (error) {
      console.error("Error loading spatial structure:", error);
      this.spatialStructure = {} as IFCNode;
    }
  }

  async getDetailedSpatialStructure(facilityId: string): Promise<any> {
    if (!this.spatialStructure) {
      await this.loadSpatialStructure();
    }

    // Create an enhanced version with properties for summary generation
    this.enhancedStructure = await this.enhanceSpatialStructureWithProperties(
      this.spatialStructure as IFCNode,
    );

    // Build the BIM filesystem from the enhanced structure
    await this.buildBimFilesystem(this.enhancedStructure, facilityId);

    console.log("Enhanced spatial structure loaded and filesystem built");

    // Download the enhanced structure as JSON
    this.downloadEnhancedStructure(facilityId);

    return this.enhancedStructure;
  }

  private downloadEnhancedStructure(facilityId: string): void {
    try {
      // Convert the enhanced structure to JSON
      const jsonString = JSON.stringify(this.enhancedStructure, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${facilityId}_enhanced_structure.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('Enhanced structure downloaded successfully');
    } catch (error) {
      console.error('Error downloading enhanced structure:', error);
    }
  }

  private async buildBimFilesystem(
    structure: IFCNode,
    facilityId: string,
  ): Promise<void> {
    try {
      // Call the API endpoint to build and save the filesystem structure
      const response = await fetch("/api/bim/build-filesystem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ structure, facilityId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to build filesystem:", errorData);
        // Still mark as ready so chat can work with structure in memory
        this.isFilesystemReady = true;
        return;
      }

      const result = await response.json();
      console.log("BIM filesystem built successfully:", result);

      this.isFilesystemReady = true;
    } catch (error) {
      console.error("Error building BIM filesystem:", error);
      // Still mark as ready so chat can work with structure in memory
      this.isFilesystemReady = true;
    }
  }

  async sendMessage(
    message: string,
    facilityId: string,
    userId: string,
  ): Promise<string> {
    if (!this.isFilesystemReady) {
      return "Please wait for the model to finish loading...";
    }

    try {
      console.log(
        "BimChatbot: Sending message:",
        message,
        "for facility:",
        facilityId,
        "user:",
        userId,
        "thread:",
        this.threadId,
      );

      const response = await fetch("/api/bim/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          facilityId,
          userId,
          threadId: this.threadId, // Send existing threadId or undefined for first message
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("BimChatbot: Received response:", data);

      // Store threadId from response for subsequent messages
      if (data.threadId) {
        this.threadId = data.threadId;
        console.log("BimChatbot: Thread ID updated:", this.threadId);
      }

      // Check if the response contains an action to perform
      if (data.action) {
        console.log(
          `BimChatbot: Executing action "${data.action}" with ${data.elementIds?.length} elements:`,
          data.elementIds,
        );

        try {
          switch (data.action) {
            case "select":
              console.log("BimChatbot: About to call selectElements");
              await this.selectElements(data.elementIds);
              console.log("BimChatbot: selectElements completed successfully");
              return `Selected ${data.elementIds.length} elements`;
            case "hide":
              await this.hideElements(data.elementIds);
              return `Hid ${data.elementIds.length} elements`;
            case "show":
              await this.showElements(data.elementIds);
              return `Showed ${data.elementIds.length} elements`;
            case "isolate":
              await this.isolateElements(data.elementIds);
              return `Isolated ${data.elementIds.length} elements`;
            default:
              console.log("BimChatbot: Unknown action:", data.action);
              return data.response || "Action completed";
          }
        } catch (actionError) {
          console.error("BimChatbot: Error executing action:", actionError);
          return `Failed to ${data.action} elements: ${actionError instanceof Error ? actionError.message : "Unknown error"}`;
        }
      }

      console.log("BimChatbot: No action to perform, returning text response");
      return data.response || "Sorry, I couldn't process your request.";
    } catch (error) {
      console.error("Error sending message:", error);
      return "An error occurred while processing your message.";
    }
  }

  private getSpatialStructureSummary(node: IFCNode, depth: number = 0): any {
    const summary: any = {
      name: node.name,
      localId: node.localId,
      depth: depth,
      properties: node.properties
        ? Object.keys(node.properties).length + " properties"
        : "no properties",
      childrenCount: node.children?.length || 0,
    };

    if (node.children && node.children.length > 0) {
      summary.children = node.children.map((child) =>
        this.getSpatialStructureSummary(child, depth + 1),
      );
    }

    return summary;
  }

  // Reset conversation to start a new thread
  resetConversation(): void {
    this.threadId = null;
    console.log(
      "BimChatbot: Conversation reset, new thread will be created on next message",
    );
  }

  // Get current thread ID
  getThreadId(): string | null {
    return this.threadId;
  }
}
