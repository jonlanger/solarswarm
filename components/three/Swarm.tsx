"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { MODELS } from "./assets";
import { bindRig } from "./Robot";

export interface SwarmPose {
  x: number;
  z: number;
  y?: number;
  yaw: number;
  tilt: number;
  azimuth: number;
  mast: number;
  /** accumulated wheel angle */
  wheel?: number;
  /** pitch about X (e.g. on a ramp) */
  pitch?: number;
  visible?: boolean;
  /** LED color (linear RGB, values > 1 bloom). Defaults to swarm purple. */
  led?: THREE.Color;
}

export const LED_PAIRED = new THREE.Color("#9d6bff").multiplyScalar(3.2);
export const LED_UNPAIRED = new THREE.Color("#e0a36a").multiplyScalar(2.6);
export const LED_FAULT = new THREE.Color("#ff4d55").multiplyScalar(3);

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Hundreds of robots as one InstancedMesh per part. A single template hierarchy is posed per
 * instance and each part's world matrix is copied into its instance slot, so the rig stays
 * identical to <Robot/> while costing one draw call per part.
 */
export function Swarm({
  max,
  poses,
  castShadow = true,
}: {
  max: number;
  /** Mutated by the parent every frame (no React re-render). */
  poses: React.RefObject<SwarmPose[]>;
  castShadow?: boolean;
}) {
  const { scene } = useGLTF(MODELS.robotLod);
  const template = useMemo(() => scene.clone(true), [scene]);
  const rig = useMemo(() => bindRig(template), [template]);
  const parts = useMemo(() => {
    const out: { mesh: THREE.Mesh; material: THREE.Material; led: boolean }[] = [];
    template.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      // front LED + status ring get a per-instance colour; unlit so values > 1 drive bloom
      const led = src.name === "LED_Front" || src.name === "LED_Status";
      const material = led ? new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }) : src;
      out.push({ mesh, material, led });
    });
    return out;
  }, [template]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useFrame(() => {
    const list = poses.current ?? [];
    const n = Math.min(max, list.length);
    for (let i = 0; i < n; i++) {
      const p = list[i];
      if (p.visible === false) {
        for (const im of refs.current) im?.setMatrixAt(i, HIDDEN);
        continue;
      }
      template.position.set(p.x, p.y ?? 0, p.z);
      template.rotation.set(p.pitch ?? 0, p.yaw, 0, "YXZ");
      rig.mast.position.y = rig.mastRest + p.mast;
      rig.azimuth.rotation.y = p.azimuth;
      rig.tilt.rotation.x = p.tilt;
      if (p.wheel !== undefined) for (const w of rig.wheels) w.rotation.x = p.wheel;
      template.updateMatrixWorld(true);
      for (let j = 0; j < parts.length; j++) {
        const im = refs.current[j];
        if (!im) continue;
        im.setMatrixAt(i, parts[j].mesh.matrixWorld);
        if (parts[j].led) im.setColorAt(i, p.led ?? LED_PAIRED);
      }
    }
    for (const im of refs.current) {
      if (!im) continue;
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      {parts.map(({ mesh, material }, j) => (
        <instancedMesh
          key={mesh.uuid}
          ref={(el) => {
            refs.current[j] = el;
          }}
          args={[mesh.geometry, material, max]}
          castShadow={castShadow}
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  );
}
