"use client";

import * as React from "react";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import * as BUIC from "@thatopen/ui-obc";
import * as THREE from "three";
import { createSmoothWheelControl } from "@/utils/smoothWheelControl";
import { createMouseOrbitControl } from "@/utils/mouseOrbitControl";

export async function createScene(container: HTMLDivElement) {
  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);

  const world = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBF.PostproductionRenderer
  >();

  world.name = "Main";
  world.scene = new OBC.SimpleScene(components);
  world.scene.setup();
  world.scene.three.background = new THREE.Color(0xffffff);

  const viewport = BUI.Component.create<BUI.Viewport>(() => {
    return BUI.html`<bim-viewport></bim-viewport>`;
  });

  const viewportElement = viewport as HTMLElement;

  container.append(viewportElement);

  // Wait for viewport to render and have proper dimensions before initializing renderer
  await new Promise<void>((resolve) => {
    const checkDimensions = () => {
      const width = viewportElement.clientWidth;
      const height = viewportElement.clientHeight;

      if (width > 0 && height > 0) {
        resolve();
      } else {
        requestAnimationFrame(checkDimensions);
      }
    };

    // Check on next frame to allow web component to render
    requestAnimationFrame(checkDimensions);
  });

  world.renderer = new OBF.PostproductionRenderer(components, viewport);
  world.camera = new OBC.OrthoPerspectiveCamera(components);
  world.camera.threePersp.near = 0.01;
  world.camera.threePersp.updateProjectionMatrix();
  world.camera.controls.restThreshold = 0.05;

  const containerRef = { current: container };

  const CamControls = (await import("camera-controls")).default;
  const controls = world.camera.controls;

  if (controls && "mouseButtons" in controls) {
    // Disable default wheel behavior - we'll handle it with isolationWheelControl
    controls.mouseButtons = {
      left: CamControls.ACTION.ROTATE,
      middle: CamControls.ACTION.TRUCK,
      right: CamControls.ACTION.TRUCK,
      wheel: CamControls.ACTION.NONE, // Important: disable default wheel
    };

    if ("minDistance" in controls) controls.minDistance = 0.3;
    if ("maxDistance" in controls) controls.maxDistance = 500;
  }

  // Smooth wheel zooming with custom configuration
  const isolationWheel = createSmoothWheelControl(
    world,
    components,
    containerRef,
  );

  const mouseOrbit = createMouseOrbitControl(world, components);

  container.addEventListener("wheel", isolationWheel.wheelHandler, {
    passive: false, // Required to prevent default scroll
  });

  container.addEventListener("mousedown", mouseOrbit.mouseDownHandler, true);
  container.addEventListener("mousemove", mouseOrbit.mouseMoveHandler, true);
  container.addEventListener("touchstart", mouseOrbit.touchStartHandler, true);
  globalThis.addEventListener("keydown", mouseOrbit.enablePanningHandler);
  globalThis.addEventListener("keyup", mouseOrbit.disablePanningHandler);

  isolationWheel.cleanup();

  BUIC.Manager.init();
  const viewCube = new BUIC.ViewCube();
  viewCube.camera = world.camera.three;
  viewCube.size = 100;
  viewCube.style.fontSize = "60px";
  viewCube.topText = "U";
  viewCube.bottomText = "D";
  viewCube.leftText = "L";
  viewCube.rightText = "R";
  viewCube.frontText = "F";
  viewCube.backText = "B";
  viewCube.style.position = "absolute";
  viewCube.style.bottom = "100px";
  viewCube.style.right = "20px";
  viewCube.style.zIndex = "10";

  container.append(viewCube);

  if (viewCube.shadowRoot) {
    const style = document.createElement("style");
    style.textContent = `
      .face {
        background-color: #e5e7eb !important;
        color: #6b7280 !important;
        transition: background-color 0.2s;
      }
      .face:hover {
        background-color: #d1d5db !important;
      }
    `;
    viewCube.shadowRoot.appendChild(style);
  }

  world.camera.controls.addEventListener("update", () =>
    viewCube.updateOrientation(),
  );

  const boxer = components.get(OBC.BoundingBoxer);
  const sphere = new THREE.Sphere();
  const getLoadedModelsBoundings = () => {
    boxer.list.clear();
    boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();
    return box;
  };

  const setCameraToBoundingSphereOffset = async (
    offsetMultiplier: THREE.Vector3,
  ) => {
    const box = getLoadedModelsBoundings();
    box.getBoundingSphere(sphere);

    const offset = offsetMultiplier.clone().multiplyScalar(sphere.radius);
    const { x, y, z } = sphere.center;

    await world.camera.controls.setLookAt(
      x + offset.x,
      y + offset.y,
      z + offset.z,
      x,
      y,
      z,
      true,
    );
    await world.camera.fitToItems();
  };

  viewCube.addEventListener("topclick", async () => {
    await setCameraToBoundingSphereOffset(new THREE.Vector3(0, 2, 0));
  });

  viewCube.addEventListener("bottomclick", async () => {
    await setCameraToBoundingSphereOffset(new THREE.Vector3(0, -2, 0));
  });

  viewCube.addEventListener("leftclick", async () => {
    await setCameraToBoundingSphereOffset(new THREE.Vector3(-2, 0, 0));
  });

  viewCube.addEventListener("rightclick", async () => {
    await setCameraToBoundingSphereOffset(new THREE.Vector3(2, 0, 0));
  });

  viewCube.addEventListener("frontclick", async () => {
    await setCameraToBoundingSphereOffset(new THREE.Vector3(0, 0, 2));
  });

  viewCube.addEventListener("backclick", async () => {
    await setCameraToBoundingSphereOffset(new THREE.Vector3(0, 0, -2));
  });

  // const worldGrid = components.get(OBC.Grids).create(world);
  // worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
  // worldGrid.material.uniforms.uSize1.value = 2;
  // worldGrid.material.uniforms.uSize2.value = 8;

  const resizeWorld = () => {
    world.renderer?.resize();
    world.camera?.updateAspect();
  };

  viewport.addEventListener("resize", resizeWorld);

  // Store cleanup function on the viewport element for later removal
  (viewportElement as any).__resizeHandler = resizeWorld;

  world.dynamicAnchor = false;

  components.init();

  components.get(OBC.Raycasters).get(world);

  return { world, components, viewport: viewportElement };
}
