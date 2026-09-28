/** Bump when the GLBs are re-exported so browsers and CDNs don't serve a stale model. */
const V = "v2-8";

export const MODELS = {
  robot: `/models/solarbot.glb?${V}`,
  robotLod: `/models/solarbot_lod.glb?${V}`,
  truck: `/models/truck.glb?${V}`,
  portal: `/models/portal.glb?${V}`,
  swap: `/models/swap_station.glb?${V}`,
} as const;

/** Self-hosted Draco decoder (copied from three/examples/jsm/libs/draco/gltf); the GLBs are Draco-compressed. */
export const DRACO = "/draco/";
