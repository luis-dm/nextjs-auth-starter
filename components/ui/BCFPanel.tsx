"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import toast from "react-hot-toast";
import { FragmentsManager, RaycastUtils, World } from "@/utils/raycastUtils";

interface FacilityUser {
  id: string;
  name: string | null;
  email: string;
}

interface BCFPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestOpen?: () => void;
  components?: any;
  world?: World;
  userEmail?: string;
  facilityUsers?: FacilityUser[];
  facilityId?: string;
}

interface TopicMarkerData {
  topicGuid: string;
  title: string;
  localId: number | null;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

interface TopicMarkerEntry {
  data: TopicMarkerData;
  sprite: THREE.Sprite;
}

export function BCFPanel({
  isOpen,
  onClose,
  onRequestOpen,
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
  const markerSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const viewpointsRef = useRef<any>(null);
  const markerEntriesRef = useRef<Map<string, TopicMarkerEntry>>(new Map());
  const pendingDropPositionRef = useRef<{
    position: THREE.Vector3;
    localId: number | null;
  } | null>(null);
  const isHydratingTopicsRef = useRef(false);
  const markerPointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const createDragOffsetRef = useRef({ x: 0, y: 0 });
  const [isCreateDragging, setIsCreateDragging] = useState(false);
  const [snapshotUpdateTrigger, setSnapshotUpdateTrigger] = useState(0);

  const getTopicTitle = (topic: any) => {
    if (typeof topic?.title === "string" && topic.title.trim().length > 0) {
      return topic.title;
    }

    if (typeof topic?.guid === "string") {
      return `Topic ${topic.guid.slice(0, 8)}`;
    }

    return "Topic";
  };

  const buildMarkerTexture = (title: string) => {
    const canvas = document.createElement("canvas");
    const width = 1024;
    const height = 512;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return new THREE.CanvasTexture(canvas);
    }

    context.fillStyle = "#0a0a0a";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "#ffffff";
    context.lineWidth = 10;
    context.strokeRect(14, 14, width - 28, height - 28);

    context.fillStyle = "#ffffff";
    context.font = "bold 112px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const maxChars = 20;
    const finalText =
      title.length > maxChars ? `${title.slice(0, maxChars - 1)}…` : title;
    context.fillText(finalText, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };

  const removeMarker = (topicGuid: string) => {
    const marker = markerEntriesRef.current.get(topicGuid);
    if (!marker) return;

    world?.scene?.three.remove(marker.sprite);
    marker.sprite.material.map?.dispose?.();
    marker.sprite.material.dispose();
    markerEntriesRef.current.delete(topicGuid);
  };

  const upsertMarker = (
    topicGuid: string,
    title: string,
    position: THREE.Vector3,
    localId: number | null,
  ) => {
    removeMarker(topicGuid);

    if (!world?.scene?.three) return;

    const texture = buildMarkerTexture(title);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.set(position.x, position.y + 0.15, position.z);
    sprite.scale.set(2.1, 0.82, 1);
    sprite.renderOrder = 9999;
    sprite.userData = { topicGuid };

    world.scene.three.add(sprite);

    markerEntriesRef.current.set(topicGuid, {
      data: {
        topicGuid,
        title,
        localId,
        position: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
      },
      sprite,
    });
  };

  const saveMarkersToDatabase = async () => {
    if (!facilityId) return;

    try {
      const markers = [...markerEntriesRef.current.values()].map(
        (entry) => entry.data,
      );

      await fetch(`/api/facilities/${facilityId}/bcf-markers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markers }),
      });
    } catch (error) {
      console.error("Error saving BCF topic markers:", error);
    }
  };

  const debouncedSaveMarkers = () => {
    if (markerSaveTimeoutRef.current) {
      clearTimeout(markerSaveTimeoutRef.current);
    }

    markerSaveTimeoutRef.current = setTimeout(() => {
      saveMarkersToDatabase();
    }, 500);
  };

  const loadMarkersFromDatabase = async () => {
    if (!facilityId) return;

    try {
      const response = await fetch(`/api/facilities/${facilityId}/bcf-markers`);
      if (!response.ok) return;

      const payload = await response.json();
      if (!Array.isArray(payload?.markers)) return;

      for (const marker of payload.markers as TopicMarkerData[]) {
        if (
          !marker?.topicGuid ||
          !marker.position ||
          typeof marker.position.x !== "number" ||
          typeof marker.position.y !== "number" ||
          typeof marker.position.z !== "number"
        ) {
          continue;
        }

        upsertMarker(
          marker.topicGuid,
          marker.title || "Topic",
          new THREE.Vector3(
            marker.position.x,
            marker.position.y,
            marker.position.z,
          ),
          typeof marker.localId === "number" ? marker.localId : null,
        );
      }
    } catch (error) {
      console.error("Error loading BCF topic markers:", error);
    }
  };

  const openTopicDetails = (topicGuid: string) => {
    const topic = bcfTopicsRef.current?.list?.get(topicGuid);
    if (!topic) {
      return;
    }

    if (!isOpen) {
      onRequestOpen?.();
    }

    setSelectedTopic(topic);
    setIsDetailsPanelOpen(true);
  };

  const saveBCFToDatabase = async () => {
    if (!bcfTopicsRef.current || !facilityId || isSaving) return;

    try {
      const allTopics = [...bcfTopicsRef.current.list.values()];
      console.log("Saving BCF to database - Topics count:", allTopics.length);

      // Allow saving even when there are 0 topics (to clear the BCF file)
      if (allTopics.length === 0) {
        console.log("No topics - will save empty BCF to clear data");
      }

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
      console.log("Loading BCF from file system for facility:", facilityId);
      const response = await fetch(`/api/facilities/${facilityId}/bcf`);
      console.log("Load response:", response.ok, response.status);

      if (!response.ok) {
        // Check if it's a 404 (no BCF file) or actual error
        if (response.status === 404) {
          console.log("No BCF file found for this facility");
          return;
        }
        console.error("Error loading BCF:", response.statusText);
        return;
      }

      // Get as ArrayBuffer directly (binary stream)
      const bcfBuffer = await response.arrayBuffer();
      console.log("BCF data received:", bcfBuffer.byteLength, "bytes");

      if (bcfBuffer.byteLength > 0) {
        await bcfTopicsRef.current.load(new Uint8Array(bcfBuffer));
        console.log("BCF data loaded successfully");
      }
    } catch (error) {
      console.error("Error loading BCF from file system:", error);
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
        viewpoints.list.onItemUpdated.add(({ value: viewpoint }: any) => {
          // Trigger re-render of details panel when viewpoint is updated
          console.log("Viewpoint updated:", viewpoint.guid);
          setSnapshotUpdateTrigger((prev) => prev + 1);
        });

        bcfTopics.list.onItemSet.add(async ({ value: topic }: any) => {
          // Check if topic already has a viewpoint
          if (topic.viewpoints.size === 0) {
            // Create single viewpoint for this topic (without snapshot)
            const viewpoint = viewpoints.create();
            topic.viewpoints.add(viewpoint.guid);

            // Trigger update to ensure UI is refreshed
            setSnapshotUpdateTrigger((prev) => prev + 1);
          }

          if (!isHydratingTopicsRef.current && pendingDropPositionRef.current) {
            const dropped = pendingDropPositionRef.current;
            upsertMarker(
              topic.guid,
              getTopicTitle(topic),
              dropped.position,
              dropped.localId,
            );
            pendingDropPositionRef.current = null;
            debouncedSaveMarkers();
          }
        });

        // When topic is updated, update its viewpoint snapshot
        bcfTopics.list.onItemUpdated.add(async ({ value: topic }: any) => {
          if (topic.viewpoints.size > 0) {
            const viewpointGuid = Array.from(topic.viewpoints)[0];
            const viewpoint = viewpoints.list.get(viewpointGuid);
            if (viewpoint) {
              await viewpoint.updateCamera();
              await viewpoint.updateSnapshot();
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
            openTopicDetails(Guid);
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
        bcfTopics.list.onItemUpdated.add(({ value: topic }: any) => {
          // Re-render details if a topic is selected
          if (selectedTopic) {
            const updatedTopic = bcfTopics.list.get(selectedTopic.guid);
            if (updatedTopic) {
              setSelectedTopic(updatedTopic);
            }
          }

          if (topic) {
            const markerEntry = markerEntriesRef.current.get(topic.guid);
            if (
              markerEntry &&
              markerEntry.data.title !== getTopicTitle(topic)
            ) {
              const currentPosition = markerEntry.data.position;
              upsertMarker(
                topic.guid,
                getTopicTitle(topic),
                new THREE.Vector3(
                  currentPosition.x,
                  currentPosition.y,
                  currentPosition.z,
                ),
                markerEntry.data.localId,
              );
              debouncedSaveMarkers();
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
          const topicGuids = new Set<string>(
            [...bcfTopics.list.values()].map((topic: any) => topic.guid),
          );

          for (const topicGuid of markerEntriesRef.current.keys()) {
            if (!topicGuids.has(topicGuid)) {
              removeMarker(topicGuid);
            }
          }

          debouncedSave();
          debouncedSaveMarkers();
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
          isHydratingTopicsRef.current = true;
          await loadBCFFromDatabase();
          await loadMarkersFromDatabase();

          const topicGuids = new Set<string>();
          for (const topic of bcfTopics.list.values()) {
            topicGuids.add(topic.guid);
            const markerEntry = markerEntriesRef.current.get(topic.guid);
            if (!markerEntry) continue;

            const title = getTopicTitle(topic);
            if (title !== markerEntry.data.title) {
              const { position, localId } = markerEntry.data;
              upsertMarker(
                topic.guid,
                title,
                new THREE.Vector3(position.x, position.y, position.z),
                localId,
              );
            }
          }

          for (const topicGuid of markerEntriesRef.current.keys()) {
            if (!topicGuids.has(topicGuid)) {
              removeMarker(topicGuid);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing BCF:", error);
      } finally {
        isHydratingTopicsRef.current = false;
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

      // Listen for viewpoint updates from the viewpoints section
      viewpoints.addEventListener("change", async () => {
        console.log("Viewpoints section changed");
        // Trigger re-render when viewpoints section detects changes
        setSnapshotUpdateTrigger((prev) => prev + 1);
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
      detailsContainer.style.cssText =
        "display: flex; flex-direction: column; padding-bottom: 2rem;";

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

      // Create combined snapshots section
      let snapshotsSection: HTMLElement | null = null;
      if (selectedTopic.viewpoints.size > 0) {
        const OBC = await import("@thatopen/components");
        const viewpointsComponent = components.get(OBC.Viewpoints);

        const allSnapshotsContainer = document.createElement("div");
        allSnapshotsContainer.style.cssText =
          "display: flex; flex-direction: column; gap: 1rem; padding: 1rem;";

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
              snapshotContainer.style.cssText =
                "display: flex; flex-direction: column; gap: 0.5rem;";

              // Add viewpoint label
              const label = document.createElement("div");
              label.textContent = `Viewpoint ${viewpointIndex}`;
              label.style.cssText =
                "font-weight: 600; color: #1c1b1f; font-size: 0.875rem;";
              snapshotContainer.appendChild(label);

              const img = document.createElement("img");
              img.src = url;
              img.alt = `Viewpoint ${viewpointIndex} Snapshot`;
              img.style.cssText =
                "width: 100%; max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);";

              snapshotContainer.appendChild(img);
              allSnapshotsContainer.appendChild(snapshotContainer);
            }
          }
        }

        if (allSnapshotsContainer.children.length > 0) {
          snapshotsSection = createSection(
            "Snapshots",
            "tabler:photo",
            allSnapshotsContainer,
          );
        }
      }

      detailsContainer.appendChild(
        createSection("Information", "ph:info-bold", information),
      );
      detailsContainer.appendChild(
        createSection("Comments", "majesticons:comment-line", comments),
      );
      if (snapshotsSection) {
        detailsContainer.appendChild(snapshotsSection);
      }
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

  useEffect(() => {
    if (!world?.renderer?.three?.domElement || !world?.camera?.three) return;

    const canvas = world.renderer.three.domElement;
    const raycaster = new THREE.Raycaster();
    const ndcPointer = new THREE.Vector2();

    const onPointerDown = (event: PointerEvent) => {
      markerPointerDownRef.current = { x: event.clientX, y: event.clientY };
    };

    const onClick = (event: MouseEvent) => {
      const down = markerPointerDownRef.current;
      if (down) {
        const moved =
          Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8;
        if (moved) {
          markerPointerDownRef.current = null;
          return;
        }
      }

      markerPointerDownRef.current = null;

      const markerSprites = [...markerEntriesRef.current.values()].map(
        (entry) => entry.sprite,
      );
      if (markerSprites.length === 0) return;

      const bounds = canvas.getBoundingClientRect();
      ndcPointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      ndcPointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      raycaster.setFromCamera(ndcPointer, world.camera!.three);
      const hits = raycaster.intersectObjects(markerSprites, true);
      if (hits.length === 0) return;

      const hitObject = hits[0].object as THREE.Object3D;
      const topicGuid = hitObject.userData?.topicGuid;
      if (!topicGuid) return;

      openTopicDetails(topicGuid);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("click", onClick);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("click", onClick);
    };
  }, [world, isOpen]);

  useEffect(() => {
    if (!isCreateDragging) return;

    document.addEventListener("mousemove", handleCreateButtonDragMove);
    document.addEventListener("mouseup", handleCreateButtonDragEnd);
    document.addEventListener("touchmove", handleCreateButtonDragMove, {
      passive: false,
    });
    document.addEventListener("touchend", handleCreateButtonDragEnd);

    return () => {
      document.removeEventListener("mousemove", handleCreateButtonDragMove);
      document.removeEventListener("mouseup", handleCreateButtonDragEnd);
      document.removeEventListener("touchmove", handleCreateButtonDragMove);
      document.removeEventListener("touchend", handleCreateButtonDragEnd);
    };
  }, [isCreateDragging]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      if (markerSaveTimeoutRef.current) {
        clearTimeout(markerSaveTimeoutRef.current);
      }

      for (const topicGuid of markerEntriesRef.current.keys()) {
        removeMarker(topicGuid);
      }
    };
  }, []);

  const openCreateTopicDialog = () => {
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

  const getEventCoords = (
    event: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
  ) => {
    if ("touches" in event) {
      const touch =
        "changedTouches" in event && event.changedTouches.length > 0
          ? event.changedTouches[0]
          : event.touches[0];

      return { x: touch.clientX, y: touch.clientY };
    }

    return { x: event.clientX, y: event.clientY };
  };

  const beginCreateTopicAtDrop = async (clientX: number, clientY: number) => {
    if (
      !world?.camera?.three ||
      !world?.renderer?.three?.domElement ||
      !components
    ) {
      toast.error("Viewer is not ready yet");
      return;
    }

    try {
      const OBC = await import("@thatopen/components");
      const fragments = components.get(
        OBC.FragmentsManager,
      ) as FragmentsManager;

      const raycastResult = await RaycastUtils.performRaycast(
        clientX,
        clientY,
        world.camera.three,
        world.renderer.three.domElement,
        fragments,
      );

      if (!raycastResult?.result?.point) {
        toast.error("Drop on a model element to create a topic marker");
        return;
      }

      pendingDropPositionRef.current = {
        position: raycastResult.result.point.clone(),
        localId: raycastResult.result.localId ?? null,
      };

      openCreateTopicDialog();
    } catch (error) {
      console.error("Failed to create topic from drag-drop:", error);
      toast.error("Could not place topic marker");
    }
  };

  const handleCreateButtonDragStart = (
    event: React.MouseEvent | React.TouchEvent,
  ) => {
    if (!createButtonRef.current) return;

    const coords = getEventCoords(event);
    const rect = createButtonRef.current.getBoundingClientRect();
    createDragOffsetRef.current = {
      x: coords.x - rect.left,
      y: coords.y - rect.top,
    };

    setIsCreateDragging(true);

    if (createButtonRef.current) {
      createButtonRef.current.style.pointerEvents = "none";
      createButtonRef.current.style.position = "fixed";
      createButtonRef.current.style.left = `${rect.left}px`;
      createButtonRef.current.style.top = `${rect.top}px`;
      createButtonRef.current.style.right = "auto";
      createButtonRef.current.style.zIndex = "1000000000";
    }

    event.preventDefault();
    event.stopPropagation();
  };

  const handleCreateButtonDragMove = (event: MouseEvent | TouchEvent) => {
    if (!createButtonRef.current) return;

    const coords = getEventCoords(event);
    const left = coords.x - createDragOffsetRef.current.x;
    const top = coords.y - createDragOffsetRef.current.y;

    createButtonRef.current.style.left = `${left}px`;
    createButtonRef.current.style.top = `${top}px`;

    event.preventDefault();
  };

  const handleCreateButtonDragEnd = async (event: MouseEvent | TouchEvent) => {
    if (!isCreateDragging || !createButtonRef.current) return;

    const coords = getEventCoords(event);
    const button = createButtonRef.current;

    button.style.pointerEvents = "";
    button.style.position = "";
    button.style.left = "";
    button.style.top = "";
    button.style.right = "";
    button.style.zIndex = "";

    setIsCreateDragging(false);

    await beginCreateTopicAtDrop(coords.x, coords.y);

    event.preventDefault();
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

  const handleDeleteTopic = () => {
    if (!selectedTopic || !bcfTopicsRef.current) return;

    bcfTopicsRef.current.list.delete(selectedTopic.guid);
    toast.success("Topic deleted");
    setIsDetailsPanelOpen(false);
    setSelectedTopic(null);
  };

  return (
    <>
      {/* Main BCF Panel */}
      <div
        className={`absolute top-0 right-0 w-[30%] h-full bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.15)] z-99999999 flex flex-col transition-all duration-300 cubic-bezier(0.4,0,0.2,1) ${
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
              ref={createButtonRef}
              onMouseDown={handleCreateButtonDragStart}
              onTouchStart={handleCreateButtonDragStart}
              onClick={(event) => {
                event.preventDefault();
                toast("Drag and drop this button on a model element");
              }}
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
          className={`absolute top-0 right-0 w-[30%] h-full bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.15)] z-999999999 flex flex-col transition-all duration-300 cubic-bezier(0.4,0,0.2,1) ${
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
            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center w-8 h-8 border-none bg-transparent rounded-md cursor-pointer text-[#1c1b1f] transition-all duration-200 ease-in-out hover:bg-red-50 hover:text-red-600"
                onClick={handleDeleteTopic}
                title="Delete topic"
              >
                <span className="material-icons text-[20px]">delete</span>
              </button>
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
