import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

export function resizeHandler(world: {
  scene: OBC.SimpleScene;
  camera: OBC.OrthoPerspectiveCamera;
  renderer: OBF.PostproductionRenderer;
}) {
  const { postproduction } = world.renderer;
  postproduction.enabled = true;
  postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;
  const { aoPass, edgesPass } = world.renderer.postproduction;
  edgesPass.color = new THREE.Color(0x494b50);
  const aoParameters = {
    radius: 0.25,
    distanceExponent: 1,
    thickness: 1,
    scale: 1,
    samples: 16,
    distanceFallOff: 1,
    screenSpaceRadius: true,
  };
  const pdParameters = {
    lumaPhi: 10,
    depthPhi: 2,
    normalPhi: 3,
    radius: 4,
    radiusExponent: 1,
    rings: 2,
    samples: 16,
  };
  aoPass.updateGtaoMaterial(aoParameters);
  aoPass.updatePdMaterial(pdParameters);
}
