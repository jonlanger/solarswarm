"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sunVectorFromAngles, trackingPose } from "@/lib/sun";
import { MODELS } from "../assets";
import type { Vec3 } from "../Robot";
import { LED_PAIRED, LED_UNPAIRED, Swarm, type SwarmPose } from "../Swarm";
import { Ground, SunAndSky } from "../World";

const deg = THREE.MathUtils.degToRad;
const ss = THREE.MathUtils.smoothstep;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/* Layout (three.js: up = +Y). The truck backs in from +Z; robots roll down the ramp toward -Z,
 * through the pairing portal, and fan out into a 6 × 8 formation. */
const ROWS = 6;
const COLS = 8;
const N = ROWS * COLS;
const TRUCK_Z = 12;
const RAMP_TOP: Vec3 = [0, 1.3, TRUCK_Z - 4.3];
const RAMP_LEN = 3.3;
const PORTAL_Z = 3;
const WHEEL_R = 0.17;

/** Scroll phases (progress 0..1). */
export const PHASES = {
  arrive: [0, 0.08],
  ramp: [0.08, 0.13],
  roll: [0.13, 0.7],
  raise: [0.7, 0.8],
  track: [0.8, 1],
} as const;
const TRAVEL = 0.16;

function sunFor(p: number): Vec3 {
  // morning until activation, then the day plays out across the array
  const k = clamp01((p - PHASES.track[0]) / (PHASES.track[1] - PHASES.track[0]));
  return sunVectorFromAngles(deg(-110 + 150 * k), deg(18 + 40 * Math.sin(Math.PI * (0.15 + 0.6 * k))));
}

interface Route {
  curve: THREE.CatmullRomCurve3;
  len: number;
  portalU: number;
  depart: number;
  target: THREE.Vector3;
}

function buildRoutes(): Route[] {
  const slots: THREE.Vector3[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) slots.push(new THREE.Vector3((c - (COLS - 1) / 2) * 2.3, 0, -3.5 - r * 2.8));
  // farthest slots are filled first so later units never cut through parked ones
  slots.sort((a, b) => a.z - b.z || Math.abs(a.x) - Math.abs(b.x));
  const [rx, ry, rz] = RAMP_TOP;
  const rampFoot = new THREE.Vector3(0, 0.02, rz - RAMP_LEN * Math.cos(deg(21.8)));
  return slots.map((target, i) => {
    const side = target.x >= 0 ? 1 : -1;
    const pts = [
      new THREE.Vector3(rx, ry, rz + 1.6),
      new THREE.Vector3(rx, ry, rz),
      rampFoot,
      new THREE.Vector3(0, 0, PORTAL_Z),
      new THREE.Vector3(side * 0.6, 0, PORTAL_Z - 2.2),
      new THREE.Vector3(target.x * 0.85, 0, Math.max(target.z + 2.4, -1.8)),
      new THREE.Vector3(target.x, 0, target.z + 1.1),
      target.clone(),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.3);
    let portalU = 0.3;
    for (let k = 0; k <= 200; k++) {
      if (curve.getPointAt(k / 200).z < PORTAL_Z) {
        portalU = k / 200;
        break;
      }
    }
    return {
      curve,
      len: curve.getLength(),
      portalU,
      depart: PHASES.roll[0] + (i / (N - 1)) * (PHASES.roll[1] - PHASES.roll[0] - TRAVEL),
      target,
    };
  });
}

function useModel(path: string) {
  const { scene } = useGLTF(path);
  return useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);
}

const CAM_POS = new THREE.CatmullRomCurve3([
  new THREE.Vector3(11, 2.4, 21),
  new THREE.Vector3(8.5, 3.2, 12.5),
  new THREE.Vector3(10, 5.5, 7),
  new THREE.Vector3(15, 10, 4),
  new THREE.Vector3(20, 15, 7),
  new THREE.Vector3(23, 23, 13),
]);
const CAM_LOOK = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 1.2, 13),
  new THREE.Vector3(0, 0.9, 6),
  new THREE.Vector3(0, 0.2, 0.5),
  new THREE.Vector3(0, 0, -5),
  new THREE.Vector3(0, 0, -8.5),
  new THREE.Vector3(0, 0, -10),
]);

export function DeployScene({ progress }: { progress: React.RefObject<number> }) {
  const routes = useMemo(buildRoutes, []);
  const truck = useModel(MODELS.truck);
  const portal = useModel(MODELS.portal);
  const portalLeds = useMemo(() => {
    const mats: THREE.MeshStandardMaterial[] = [];
    portal.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.material as THREE.Material).name.startsWith("LED")) {
        m.material = (m.material as THREE.MeshStandardMaterial).clone();
        mats.push(m.material as THREE.MeshStandardMaterial);
      }
    });
    return mats;
  }, [portal]);

  const truckRef = useRef<THREE.Group>(null);
  const rampRef = useRef<THREE.Group>(null);
  const poses = useRef<SwarmPose[]>([]);
  const [sun, setSun] = useState<Vec3>(() => sunFor(0));
  const sunKey = useRef(-1);
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const smooth = useRef(0);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), l: new THREE.Vector3() }), []);

  useFrame((state, dt) => {
    // ease toward the scroll position so wheel-scrolling still feels continuous
    smooth.current = THREE.MathUtils.damp(smooth.current, progress.current ?? 0, 6, dt);
    const p = smooth.current;

    const s = sunFor(p);
    const key = Math.round(p * 120);
    if (key !== sunKey.current) {
      sunKey.current = key;
      setSun(s);
    }

    // truck arrival (reversing in) + ramp
    const arrive = ss(p, PHASES.arrive[0], PHASES.arrive[1]);
    const truckOffset = (1 - arrive) * 46;
    if (truckRef.current) truckRef.current.position.z = TRUCK_Z + truckOffset;
    if (rampRef.current) {
      rampRef.current.position.z = RAMP_TOP[2] + truckOffset;
      rampRef.current.rotation.x = THREE.MathUtils.lerp(deg(88), deg(-21.8), ss(p, PHASES.ramp[0], PHASES.ramp[1]));
    }

    const raise = ss(p, PHASES.raise[0], PHASES.raise[1]);
    const trackAmt = ss(p, PHASES.raise[0] + 0.04, PHASES.track[0] + 0.02);
    const sp = trackingPose(s, 0);
    let crossing = 0;

    const list: SwarmPose[] = poses.current;
    list.length = N + 6;
    let departed = 0;
    routes.forEach((r, i) => {
      const u0 = (p - r.depart) / TRAVEL;
      if (u0 <= 0) {
        list[i] = { x: 0, z: 0, yaw: 0, tilt: 0, azimuth: 0, mast: 0, visible: false };
        return;
      }
      departed++;
      const u = ss(clamp01(u0), 0, 1);
      r.curve.getPointAt(u, tmp.p);
      r.curve.getTangentAt(Math.min(u, 0.999), tmp.t);
      const moving = u < 1;
      const yaw = moving ? Math.atan2(-tmp.t.x, -tmp.t.z) : 0;
      const pitch = moving ? Math.atan2(tmp.t.y, Math.hypot(tmp.t.x, tmp.t.z)) : 0;
      if (Math.abs(u - r.portalU) < 0.03) crossing = 1;
      const paired = u > r.portalU;
      list[i] = {
        x: tmp.p.x,
        y: tmp.p.y,
        z: tmp.p.z,
        yaw: moving ? yaw : THREE.MathUtils.lerp(yaw, 0, 1),
        pitch,
        wheel: -(u * r.len) / WHEEL_R,
        mast: -0.18 + 0.28 * raise,
        tilt: sp.tilt * trackAmt,
        azimuth: sp.azimuth * trackAmt,
        led: paired ? LED_PAIRED : LED_UNPAIRED,
      };
    });
    // units still stowed on the bed (six visible slots that empty as the queue drains)
    const remaining = N - departed;
    for (let k = 0; k < 6; k++) {
      const visible = remaining > k * (N / 6);
      list[N + k] = {
        x: k % 2 ? 0.62 : -0.62,
        y: 1.28,
        z: TRUCK_Z + truckOffset - 2.5 + Math.floor(k / 2) * 2.0,
        yaw: Math.PI,
        tilt: 0,
        azimuth: 0,
        mast: -0.18,
        visible,
        led: LED_UNPAIRED,
      };
    }

    // portal glows while units pair
    const on = ss(p, PHASES.ramp[0], PHASES.ramp[1]);
    for (const m of portalLeds) m.emissiveIntensity = on * (5 + 9 * crossing + 1.5 * Math.sin(state.clock.elapsedTime * 3));

    // camera rig along a spline
    CAM_POS.getPoint(p, tmp.p);
    CAM_LOOK.getPoint(p, tmp.l);
    camera.position.copy(tmp.p);
    camera.lookAt(tmp.l);
    // on wide screens, shift the image right so the action clears the caption column
    if (size.width > 900) camera.setViewOffset(size.width, size.height, -size.width * 0.17, 0, size.width, size.height);
    else camera.clearViewOffset();
  });

  return (
    <>
      <SunAndSky sun={sun} shadowSize={34} shadowTarget={[0, 0, -2]} envFrames={Infinity} />
      <Ground kind="desert" />
      <group ref={truckRef} rotation-y={Math.PI} position={[0, 0, TRUCK_Z]}>
        <primitive object={truck} />
      </group>
      <group ref={rampRef} position={RAMP_TOP}>
        <mesh position={[0, -0.03, -RAMP_LEN / 2]} castShadow receiveShadow>
          <boxGeometry args={[1.3, 0.05, RAMP_LEN]} />
          <meshStandardMaterial color="#c9cbd1" metalness={1} roughness={0.35} />
        </mesh>
        {[-0.67, 0.67].map((x) => (
          <mesh key={x} position={[x, 0.02, -RAMP_LEN / 2]} castShadow>
            <boxGeometry args={[0.05, 0.08, RAMP_LEN]} />
            <meshStandardMaterial color="#e0a36a" metalness={1} roughness={0.25} />
          </mesh>
        ))}
      </group>
      <group position={[0, 0, PORTAL_Z]}>
        <primitive object={portal} />
      </group>
      <Swarm max={N + 6} poses={poses} />
    </>
  );
}

useGLTF.preload(MODELS.truck);
useGLTF.preload(MODELS.portal);
