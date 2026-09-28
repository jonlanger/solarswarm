"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { trackingPose } from "@/lib/sun";
import { DRACO, MODELS } from "./assets";

export type Vec3 = [number, number, number];

export interface RobotRig {
  root: THREE.Object3D;
  mast: THREE.Object3D;
  azimuth: THREE.Object3D;
  tilt: THREE.Object3D;
  wheels: THREE.Object3D[];
  mastRest: number;
  ledFront?: THREE.MeshStandardMaterial;
  ledRear?: THREE.MeshStandardMaterial;
  status?: THREE.MeshStandardMaterial;
}

/** Find the rig nodes (names are the contract from blender/build_robot.py). */
export function bindRig(root: THREE.Object3D): RobotRig {
  const get = (n: string) => {
    const o = root.getObjectByName(n);
    if (!o) throw new Error(`SolarBot rig node missing: ${n}`);
    return o;
  };
  const mast = get("mast_height");
  const rig: RobotRig = {
    root,
    mast,
    azimuth: get("panel_azimuth"),
    tilt: get("panel_tilt"),
    wheels: ["wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR"].map(get),
    mastRest: mast.position.y,
  };
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m) return;
    if (m.name === "LED_Front") rig.ledFront = m;
    if (m.name === "LED_Rear") rig.ledRear = m;
    if (m.name === "LED_Status") rig.status = m;
  });
  return rig;
}

/** Clone a robot scene with its own LED materials so each unit can show its own status. */
export function cloneRobot(scene: THREE.Object3D) {
  const clone = scene.clone(true);
  clone.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = mesh.material as THREE.MeshStandardMaterial;
    if (m.name.startsWith("LED_")) mesh.material = m.clone();
    if (m.name.startsWith("PV_Cells")) m.envMapIntensity = 1.4;
  });
  return clone;
}

export type RobotProps = Omit<ThreeElements["group"], "ref"> & {
  lod?: boolean;
  tilt?: number;
  azimuth?: number;
  /** Mast extension in meters (−0.18 stowed … 0.25 max). */
  mast?: number;
  /** Wheel angular speed (rad/s). */
  wheelSpeed?: number;
  /** If set, overrides tilt/azimuth to point the panel at the sun. */
  trackSun?: Vec3;
  /** Robot heading (rotation about Y) — needed for sun tracking. */
  yaw?: number;
  ledColor?: string;
  ledIntensity?: number;
  /** Response speed of actuators (higher = snappier). */
  damping?: number;
};

export function Robot({
  lod = false,
  tilt = 0,
  azimuth = 0,
  mast = 0,
  wheelSpeed = 0,
  trackSun,
  yaw = 0,
  ledColor,
  ledIntensity,
  damping = 3,
  ...group
}: RobotProps) {
  const { scene } = useGLTF(lod ? MODELS.robotLod : MODELS.robot, DRACO);
  const obj = useMemo(() => cloneRobot(scene), [scene]);
  const rig = useMemo(() => bindRig(obj), [obj]);
  const target = useRef({ tilt, azimuth, mast });

  const pose = trackSun ? trackingPose(trackSun, yaw) : null;
  target.current = {
    tilt: pose ? pose.tilt : tilt,
    azimuth: pose ? pose.azimuth : azimuth,
    mast,
  };

  // start at the target pose (no ease-in from zero on mount)
  useLayoutEffect(() => {
    const t = target.current;
    rig.tilt.rotation.x = t.tilt;
    rig.azimuth.rotation.y = t.azimuth;
    rig.mast.position.y = rig.mastRest + t.mast;
  }, [rig]);

  useLayoutEffect(() => {
    const c = ledColor ? new THREE.Color(ledColor) : null;
    for (const m of [rig.ledFront, rig.status]) {
      if (!m) continue;
      if (c) {
        m.emissive.copy(c);
        m.color.copy(c);
      }
      if (ledIntensity !== undefined) m.emissiveIntensity = ledIntensity;
    }
  }, [rig, ledColor, ledIntensity]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.1);
    const t = target.current;
    rig.tilt.rotation.x = THREE.MathUtils.damp(rig.tilt.rotation.x, t.tilt, damping, d);
    // shortest-path azimuth
    let da = t.azimuth - rig.azimuth.rotation.y;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    rig.azimuth.rotation.y += da * (1 - Math.exp(-damping * d));
    rig.mast.position.y = THREE.MathUtils.damp(rig.mast.position.y, rig.mastRest + t.mast, damping, d);
    // positive speed = rolling forward (−Z), i.e. negative rotation about X
    if (wheelSpeed) for (const w of rig.wheels) w.rotation.x -= wheelSpeed * d;
  });

  return (
    <group rotation-y={yaw} {...group}>
      <primitive object={obj} />
    </group>
  );
}

useGLTF.preload(MODELS.robot, DRACO);
useGLTF.preload(MODELS.robotLod, DRACO);
