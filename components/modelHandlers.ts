"use client";

import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

export function uiHandlers(
  components: OBC.Components,
  world: OBC.World,
  viewport: HTMLElement,
) {
  const highlighter = components.get(OBF.Highlighter);
  highlighter.setup({
    world,
    selectMaterialDefinition: {
      color: new THREE.Color("#6b7280"),
      renderedFaces: 1,
      opacity: 1,
      transparent: false,
    },
  });

  const hoverer = components.get(OBF.Hoverer);
  hoverer.world = world;
  hoverer.enabled = true;
  hoverer.material = new THREE.MeshBasicMaterial({
    color: "#6b7280",
    transparent: true, // transparent must be true to allow the animation
    opacity: 0.5, // this will act as the maximum possible opacity when animating
    depthTest: false, // recommended to avoid z-fighting
  });

  // Clipper Setup
  const clipper = components.get(OBC.Clipper);

  // Get measurement tools early for double-click handling
  const lengthMeasurer = components.get(OBF.LengthMeasurement);
  const areaMeasurer = components.get(OBF.AreaMeasurement);

  // Length Measurement Setup
  lengthMeasurer.world = world;
  lengthMeasurer.color = new THREE.Color("#6b7280");

  lengthMeasurer.list.onItemAdded.add((line) => {
    const center = new THREE.Vector3();
    line.getCenter(center);
    const radius = line.distance() / 3;
    const sphere = new THREE.Sphere(center, radius);
    world.camera.controls?.fitToSphere(sphere, true);
  });

  // Area Measurement Setup
  areaMeasurer.world = world;
  areaMeasurer.color = new THREE.Color("#6b7280");

  const handleClick = () => {
    if (lengthMeasurer.enabled) {
      lengthMeasurer.create();
    } else if (areaMeasurer.enabled) {
      areaMeasurer.create();
    } else if (clipper.enabled) {
      clipper.create(world);
      clipper.config.color = new THREE.Color("#000000");
      clipper.config.opacity = 0.8;
      clipper.config.size = 15;
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!world?.renderer) return;

    if (event.code === "Delete" || event.code === "Backspace") {
      clipper.delete(world);
      lengthMeasurer.delete();
      areaMeasurer.delete();
    } else if (event.code === "Enter" || event.code === "NumpadEnter") {
      if (lengthMeasurer.enabled) {
        lengthMeasurer.endCreation();
      } else if (areaMeasurer.enabled) {
        areaMeasurer.endCreation();
      }
    }
  };

  viewport.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeyDown);

  return () => {
    viewport.removeEventListener("click", handleClick);
    window.removeEventListener("keydown", handleKeyDown);
  };
}
