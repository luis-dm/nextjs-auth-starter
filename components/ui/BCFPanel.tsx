"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface FacilityUser {
  id: string;
  name: string | null;
  email: string;
}

interface BCFPanelProps {
  isOpen: boolean;
  onClose: () => void;
  components?: any;
  world?: any;
  userEmail?: string;
  facilityUsers?: FacilityUser[];
  facilityId?: string;
}

export function BCFPanel({
  isOpen,
  onClose,
  components,
  world,
  userEmail = "user@example.com",
  facilityUsers = [],
  facilityId,
}: BCFPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailsContainerRef = useRef<HTMLDivElement>(null);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const bcfTopicsRef = useRef<any>(null);
  const topicsListRef = useRef<any>(null);
  const topicFormRef = useRef<any>(null);
  const updateTopicFormRef = useRef<any>(null);
  const BUIRef = useRef<any>(null);
  const CUIRef = useRef<any>(null);
  const usersRef = useRef<any>(null);
  const hasLoadedBCFRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const viewpointsRef = useRef<any>(null);
  const [snapshotUpdateTrigger, setSnapshotUpdateTrigger] = useState(0);

  const saveBCFToDatabase = async () => {
    if (!bcfTopicsRef.current || !facilityId || isSaving) return;

    try {
      const allTopics = [...bcfTopicsRef.current.list.values()];
      console.log("Saving BCF to database - Topics count:", allTopics.length);
      if (allTopics.length === 0) return;

      setIsSaving(true);
      const bcfData = await bcfTopicsRef.current.export(allTopics);
      console.log(
        "BCF data exported, type:",
        typeof bcfData,
        "constructor:",
        bcfData?.constructor?.name,
      );
      console.log("BCF data:", bcfData);
      console.log("Is Uint8Array?", bcfData instanceof Uint8Array);
      console.log("Is ArrayBuffer?", bcfData instanceof ArrayBuffer);

      // Check different possible formats
      let dataToSave;
      if (bcfData instanceof Uint8Array) {
        dataToSave = bcfData;
        console.log("Using Uint8Array directly, size:", dataToSave.length);
      } else if (bcfData instanceof ArrayBuffer) {
        dataToSave = new Uint8Array(bcfData);
        console.log(
          "Converted ArrayBuffer to Uint8Array, size:",
          dataToSave.length,
        );
      } else if (bcfData && typeof bcfData === "object") {
        // Might be a Blob or File
        console.log("Unknown object type, trying to convert...");
        if (bcfData.arrayBuffer) {
          const buffer = await bcfData.arrayBuffer();
          dataToSave = new Uint8Array(buffer);
          console.log("Converted via arrayBuffer(), size:", dataToSave.length);
        } else {
          console.error("Cannot convert bcfData to array");
          setIsSaving(false);
          return;
        }
      } else {
        console.error("Export returned invalid data type");
        setIsSaving(false);
        return;
      }

      if (!dataToSave || dataToSave.length === 0) {
        console.warn("Export returned empty data");
        setIsSaving(false);
        return;
      }

      const bcfArray = Array.from(dataToSave);

      const response = await fetch(`/api/facilities/${facilityId}/bcf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bcfData: bcfArray }),
      });
      console.log("Save response:", response.ok, response.status);
    } catch (error) {
      console.error("Error saving BCF to database:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced save to allow viewpoints to be attached first
  const debouncedSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveBCFToDatabase();
    }, 500); // Wait 500ms to let viewpoints attach
  };

  const loadBCFFromDatabase = async () => {
    if (!bcfTopicsRef.current || !facilityId) return;

    try {
      console.log("Loading BCF from database for facility:", facilityId);
      const response = await fetch(`/api/facilities/${facilityId}/bcf`);
      console.log("Load response:", response.ok, response.status);
      if (!response.ok) return;

      const data = await response.json();
      console.log(
        "BCF data received:",
        data.bcfData ? `${data.bcfData.length} bytes` : "null",
      );
      if (data.bcfData && data.bcfData.length > 0) {
        const bcfBuffer = new Uint8Array(data.bcfData);
        await bcfTopicsRef.current.load(bcfBuffer);
        console.log("BCF data loaded successfully");
      }
    } catch (error) {
      console.error("Error loading BCF from database:", error);
    }
  };

  useEffect(() => {
    if (!components || !world || !containerRef.current) return;

    const initBCF = async () => {
      try {
        const BUI = await import("@thatopen/ui");
        const OBC = await import("@thatopen/components");
        const CUI = await import("@thatopen/ui-obc");

        // Store refs for later use
        BUIRef.current = BUI;
        CUIRef.current = CUI;

        // Initialize BUI Manager
        BUI.Manager.init();

        // Setup BCF Topics
        const bcfTopics = components.get(OBC.BCFTopics);
        bcfTopicsRef.current = bcfTopics;

        // Build users object from facility members
        const users: any = {};
        const userEmails = new Set<string>();

        if (facilityUsers.length > 0) {
          facilityUsers.forEach((user) => {
            users[user.email] = {
              name: user.name || user.email.split("@")[0],
              picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || user.email)}`,
            };
            userEmails.add(user.email);
          });
        } else {
          // Fallback if no facility users provided
          users[userEmail] = {
            name: userEmail.split("@")[0],
            picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userEmail)}`,
          };
          userEmails.add(userEmail);
        }

        usersRef.current = users;

        bcfTopics.setup({
          author: userEmail,
          users: userEmails,
          types: new Set([
            "Issue",
            "Error",
            "Warning",
            "Information",
            "Coordination",
            "Clash",
            "Request",
          ]),
          statuses: new Set([
            "Active",
            "In Progress",
            "Done",
            "In Review",
            "Closed",
            "Resolved",
          ]),
          priorities: new Set(["Low", "Normal", "High", "Critical"]),
          labels: new Set([
            "Architecture",
            "Structure",
            "MEP",
            "Electrical",
            "Plumbing",
            "HVAC",
          ]),
          stages: new Set([
            "Conceptual Design",
            "Schematic Design",
            "Design Development",
            "Construction Documentation",
            "Bidding",
            "Construction",
            "Closeout",
          ]),
          version: "3",
        });

        // Initialize Viewpoints
        const viewpoints = components.get(OBC.Viewpoints);
        viewpoints.world = world;
        viewpointsRef.current = viewpoints;

        // Listen for snapshot updates to refresh the details panel
        viewpoints.list.onItemUpdated.add(() => {
          // Trigger re-render of details panel when viewpoint is updated
          setSnapshotUpdateTrigger((prev) => prev + 1);
        });

        bcfTopics.list.onItemSet.add(async ({ value: topic }: any) => {
          // Check if topic already has a viewpoint
          if (topic.viewpoints.size === 0) {
            // Create single viewpoint for this topic
            const viewpoint = viewpoints.create();
            await viewpoint.updateCamera();
            await viewpoint.setSnapshot();
            topic.viewpoints.add(viewpoint.guid);
          }
        });

        // When topic is updated, update its viewpoint snapshot
        bcfTopics.list.onItemUpdated.add(async ({ value: topic }: any) => {
          if (topic.viewpoints.size > 0) {
            const viewpointGuid = Array.from(topic.viewpoints)[0];
            const viewpoint = viewpoints.list.get(viewpointGuid);
            if (viewpoint) {
              await viewpoint.updateCamera();
              await viewpoint.setSnapshot();
            }
          }
        });

        // Create Topics List Table
        const [topicsList] = CUI.tables.topicsList({
          components,
          dataStyles: { users },
        });
        topicsList.selectableRows = true;
        topicsListRef.current = topicsList;

        // Create Topic Form
        const [topicForm, updateTopicForm] = CUI.forms.topic({
          components,
          styles: { users },
        });
        topicFormRef.current = topicForm;
        updateTopicFormRef.current = updateTopicForm;

        // Handle row clicks to show details
        topicsList.addEventListener("rowcreated", (event: any) => {
          const { row } = event.detail;
          row.addEventListener("click", () => {
            const { Guid } = row.data;
            if (!Guid) return;
            const topic = bcfTopics.list.get(Guid);
            if (!topic) return;

            // Set the selected topic and open the panel
            setSelectedTopic(topic);
            setIsDetailsPanelOpen(true);
          });

          row.style.cursor = "pointer";
          row.addEventListener("mouseover", () => {
            row.style.backgroundColor = "#f0f0f0";
          });
          row.addEventListener("mouseout", () => {
            row.style.removeProperty("background-color");
          });
        });

        // Update details when topics change
        bcfTopics.list.onItemUpdated.add(() => {
          // Re-render details if a topic is selected
          if (selectedTopic) {
            const updatedTopic = bcfTopics.list.get(selectedTopic.guid);
            if (updatedTopic) {
              setSelectedTopic({ ...updatedTopic });
            }
          }
          // Auto-save when topics are updated
          debouncedSave();
        });

        // Auto-save when topics are added or removed
        bcfTopics.list.onItemSet.add(() => {
          debouncedSave();
        });

        bcfTopics.list.onItemDeleted.add(() => {
          debouncedSave();
        });

        // Setup form callbacks
        updateTopicForm({
          onCancel: () => {
            // Form will be closed by the dialog
          },
          onSubmit: () => {
            // Form will be closed by the dialog
          },
        });

        // Render main panel content
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          containerRef.current.appendChild(topicsList);
        }

        // Load BCF data from database AFTER everything is set up
        if (facilityId && !hasLoadedBCFRef.current) {
          hasLoadedBCFRef.current = true;
          await loadBCFFromDatabase();
        }
      } catch (error) {
        console.error("Error initializing BCF:", error);
      }
    };

    initBCF();
  }, [components, world, userEmail, facilityUsers]);

  // Effect to render topic details when a topic is selected
  useEffect(() => {
    if (
      !selectedTopic ||
      !detailsContainerRef.current ||
      !BUIRef.current ||
      !CUIRef.current ||
      !components ||
      !world
    )
      return;

    const renderTopicDetails = async () => {
      const BUI = BUIRef.current;
      const CUI = CUIRef.current;

      const [information] = CUI.sections.topicInformation({
        components,
        topic: selectedTopic,
        styles: { users: usersRef.current },
      });

      const [viewpoints] = CUI.sections.topicViewpoints({
        components,
        topic: selectedTopic,
        world,
      });

      const [relatedTopics] = CUI.sections.topicRelations({
        components,
        topic: selectedTopic,
      });

      const [comments] = CUI.sections.topicComments({
        topic: selectedTopic,
        styles: usersRef.current,
      });

      // Create a container div and append all sections with headers
      const detailsContainer = document.createElement("div");
      detailsContainer.style.padding = "1.5rem";

      // Create section wrappers with headers
      const createSection = (
        title: string,
        icon: string,
        content: HTMLElement,
      ) => {
        const section = document.createElement("bim-panel-section");
        section.setAttribute("label", title);
        section.setAttribute("icon", icon);
        section.appendChild(content);
        return section;
      };

      // Create viewpoint snapshots section
      const snapshotSections: HTMLElement[] = [];
      if (selectedTopic.viewpoints.size > 0) {
        const OBC = await import("@thatopen/components");
        const viewpointsComponent = components.get(OBC.Viewpoints);

        let viewpointIndex = 0;
        for (const viewpointGuid of selectedTopic.viewpoints) {
          viewpointIndex++;
          const viewpoint = viewpointsComponent.list.get(viewpointGuid);

          if (viewpoint && viewpoint.snapshot) {
            const snapshotData = viewpointsComponent.snapshots.get(
              viewpoint.snapshot,
            );
            if (snapshotData) {
              const blob = new Blob([snapshotData], { type: "image/png" });
              const url = URL.createObjectURL(blob);

              const snapshotContainer = document.createElement("div");
              snapshotContainer.style.cssText = "padding: 1rem;";

              // Add viewpoint label
              const label = document.createElement("div");
              label.textContent = `Viewpoint ${viewpointIndex}`;
              label.style.cssText =
                "font-weight: 600; margin-bottom: 0.5rem; color: #1c1b1f; font-size: 0.875rem;";
              snapshotContainer.appendChild(label);

              const img = document.createElement("img");
              img.src = url;
              img.alt = `Viewpoint ${viewpointIndex} Snapshot`;
              img.style.cssText =
                "width: 100%; max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);";

              snapshotContainer.appendChild(img);
              snapshotSections.push(
                createSection(
                  `Snapshot ${viewpointIndex}`,
                  "tabler:photo",
                  snapshotContainer,
                ),
              );
            }
          }
        }
      }

      detailsContainer.appendChild(
        createSection("Information", "ph:info-bold", information),
      );
      detailsContainer.appendChild(
        createSection("Comments", "majesticons:comment-line", comments),
      );
      snapshotSections.forEach((section) => {
        detailsContainer.appendChild(section);
      });
      detailsContainer.appendChild(
        createSection("Viewpoints", "tabler:camera", viewpoints),
      );
      detailsContainer.appendChild(
        createSection("Related Topics", "tabler:link", relatedTopics),
      );

      if (detailsContainerRef.current) {
        detailsContainerRef.current.innerHTML = "";
        detailsContainerRef.current.appendChild(detailsContainer);
      }
    };

    renderTopicDetails();
  }, [selectedTopic, components, world, snapshotUpdateTrigger]);

  const handleCreateTopic = () => {
    if (!topicFormRef.current) return;

    // Show form in a simple way (you could also create a modal)
    const formDialog = document.createElement("dialog");
    formDialog.style.cssText = `
      border: none;
      border-radius: 8px;
      padding: 0;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    `;
    formDialog.appendChild(topicFormRef.current);
    document.body.appendChild(formDialog);
    formDialog.showModal();

    // Close dialog on form submit/cancel
    const closeDialog = () => {
      formDialog.close();
      formDialog.remove();
    };

    if (updateTopicFormRef.current) {
      updateTopicFormRef.current({
        onCancel: closeDialog,
        onSubmit: closeDialog,
      });
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (topicsListRef.current) {
      topicsListRef.current.queryString = e.target.value;
    }
  };

  const handleCloseDetails = () => {
    setIsDetailsPanelOpen(false);
    setSelectedTopic(null);
  };

  return (
    <>
      {/* Main BCF Panel */}
      <div
        className={`absolute top-0 right-0 w-[30%] h-full bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.15)] z-[99999999] flex flex-col transition-all duration-300 cubic-bezier(0.4,0,0.2,1) ${
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
              topic
            </span>
            <h2 className="m-0 text-base font-normal text-[#1c1b1f] leading-8 flex items-center p-0">
              BCF Topics
            </h2>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 border-none bg-transparent rounded-md cursor-pointer text-[#1c1b1f] transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
          >
            <span className="material-icons text-[20px]">close</span>
          </button>
        </div>

        {/* Controls */}
        <div className="p-2.5 border-b border-gray-200 bg-[#f7f8fa] shrink-0">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Search topics..."
              onChange={handleSearch}
              className="w-full px-3 py-2 border bg-white border-gray-200 rounded-lg text-sm text-black placeholder:text-gray-500 focus:outline-none focus:border-[#2196f3] focus:ring-1 focus:ring-[#2196f3]"
            />
            <button
              onClick={handleCreateTopic}
              className="flex items-center justify-center px-4 py-2 border border-gray-200 bg-white rounded-[20px] cursor-pointer text-gray-700 text-sm transition-all duration-200 ease-in-out hover:bg-gray-100 hover:border-gray-300"
            >
              <span className="material-icons text-lg mr-2">add</span>
              Create Topic
            </button>
            {isSaving && (
              <p className="text-xs text-gray-500 text-center mt-1">
                Saving...
              </p>
            )}
          </div>
        </div>

        {/* Topics List - CUI Component */}
        <div className="flex-1 overflow-y-auto" ref={containerRef}>
          {/* Topics list table will be inserted here */}
        </div>
      </div>

      {/* Topic Details Panel - Slides over the main panel */}
      {isDetailsPanelOpen && (
        <div
          className={`absolute top-0 right-0 w-[30%] h-full bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.15)] z-[999999999] flex flex-col transition-all duration-300 cubic-bezier(0.4,0,0.2,1) ${
            isDetailsPanelOpen
              ? "transform translate-x-0 pointer-events-auto visible"
              : "transform translate-x-full pointer-events-none invisible"
          } max-lg:w-[40%] max-md:w-[60%] max-sm:w-[85%]`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-[10px_24px] border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3">
              <button
                className="flex items-center justify-center w-8 h-8 border-none bg-transparent rounded-md cursor-pointer text-[#1c1b1f] transition-all duration-200 ease-in-out hover:bg-gray-100"
                onClick={handleCloseDetails}
              >
                <span className="material-icons text-[20px]">arrow_back</span>
              </button>
              <h2 className="m-0 text-base font-normal text-[#1c1b1f] leading-8 flex items-center p-0">
                Topic Details
              </h2>
            </div>
            <button
              className="flex items-center justify-center w-8 h-8 border-none bg-transparent rounded-md cursor-pointer text-[#1c1b1f] transition-all duration-200 ease-in-out hover:bg-gray-100 hover:text-gray-700"
              onClick={() => {
                handleCloseDetails();
                onClose();
              }}
            >
              <span className="material-icons text-[20px]">close</span>
            </button>
          </div>

          {/* Content - CUI Topic Panel */}
          <div className="flex-1 overflow-y-auto" ref={detailsContainerRef}>
            {/* Topic panel sections will be inserted here */}
          </div>
        </div>
      )}
    </>
  );
}
