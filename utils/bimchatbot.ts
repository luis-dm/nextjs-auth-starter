import * as OBC from "@thatopen/components";

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

  constructor(components: OBC.Components) {
    this.components = components;
    this.fragments = components.get(OBC.FragmentsManager);
  }

  private async enhanceSpatialStructureWithProperties(
    node: IFCNode,
  ): Promise<any> {
    // If this node has a localId, extract detailed properties similar to generatePropertiesTSV
    if (node.localId && typeof node.localId === "number") {
      try {
        const model = Array.from(this.fragments.list.values())[0];
        if (model && model.getItemsData) {
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

    return this.enhancedStructure;
  }

  private async buildBimFilesystem(structure: IFCNode, facilityId: string): Promise<void> {
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

  async sendMessage(message: string): Promise<string> {
    if (!this.isFilesystemReady) {
      return "Please wait for the model to finish loading...";
    }

    try {
      const response = await fetch("/api/bim/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.statusText}`);
      }

      const data = await response.json();
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
}
