"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sunVectorFromAngles, trackingPose } from "@/lib/sun";
import { DRACO, MODELS } from "../assets";
import type { Vec3 } from "../Robot";
import { LED_PAIRED, LED_UNPAIRED, Swarm, type SwarmPose } from "../Swarm";
import { Ground, SunAndSky } from "../World";
import {
  BED_REAR,
  BED_Y,
  CAM_LOOK,
  CAM_POS,
  GATE_Z,
  LANE_X,
  N,
  PARKED_TRUCK,
  PHASES,
  RAMP_ANG,
  RAMP_LEN,
  SWAP_CAM,
  SWAP_POS,
  TRUCKS,
  buildPlan,
  camU,
  clamp01,
  frame,
  rampDown,
  toSwapCam,
  type TruckState,
  type UnitPose,
} from "./deployPlan";

export { PHASES };

const deg = THREE.MathUtils.degToRad;

function sunFor(p: number): Vec3 {
  // morning until activation, then the day plays out across tracking and swapping
  const k = clamp01((p - PHASES.track[0]) / (1 - PHASES.track[0]));
  return sunVectorFromAngles(deg(-110 + 150 * k), deg(18 + 40 * Math.sin(Math.PI * (0.15 + 0.6 * k))));
}

function useModel(path: string) {
  const { scene } = useGLTF(path, DRACO);
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

function ledMaterials(root: THREE.Object3D) {
  const mats: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.Material).name.startsWith("LED")) {
      m.material = (m.material as THREE.MeshStandardMaterial).clone();
      mats.push(m.material as THREE.MeshStandardMaterial);
    }
  });
  return mats;
}

/** Two bed-lane ramps hinged at the bed's rear edge (truck-local: +z points out of the rear); stowed upright. */
function Ramps({ onRef }: { onRef: (i: number, g: THREE.Group | null) => void }) {
  return (
    <>
      {[-LANE_X, LANE_X].map((x, i) => (
        <group key={x} ref={(g) => onRef(i, g)} position={[x, BED_Y, BED_REAR]} rotation-x={-Math.PI / 2}>
          <mesh position={[0, -0.025, RAMP_LEN / 2]} castShadow receiveShadow>
            <boxGeometry args={[1.12, 0.05, RAMP_LEN]} />
            <meshStandardMaterial color="#2a2a30" metalness={0.8} roughness={0.55} />
          </mesh>
          {[-0.54, 0.54].map((cx) => (
            <mesh key={cx} position={[cx, 0.02, RAMP_LEN / 2]} castShadow>
              <boxGeometry args={[0.04, 0.07, RAMP_LEN]} />
              <meshStandardMaterial color="#34353b" metalness={1} roughness={0.38} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

export function DeployScene({ progress }: { progress: React.RefObject<number> }) {
  const plan = useMemo(buildPlan, []);
  const truckModel = useModel(MODELS.truck);
  // four convoy trucks + the one that dropped the swap station
  const trucks = useMemo(() => Array.from({ length: TRUCKS + 1 }, () => truckModel.clone(true)), [truckModel]);
  const portal = useModel(MODELS.portal);
  const swap = useModel(MODELS.swap);
  const portalLeds = useMemo(() => ledMaterials(portal), [portal]);
  const swapLeds = useMemo(() => ledMaterials(swap), [swap]);

  const truckRefs = useRef<(THREE.Group | null)[]>([]);
  const rampRefs = useRef<(THREE.Group | null)[]>([]);
  const cassetteRefs = useRef<(THREE.Group | null)[]>([]);
  const poses = useRef<SwarmPose[]>([]);
  const state = useMemo(
    () => ({
      trucks: Array.from({ length: TRUCKS }, (): TruckState => ({ x: 0, z: 120, yaw: Math.PI, visible: false })),
      units: Array.from({ length: N }, (): UnitPose => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, wheel: 0, mast: 0, track: 0, paired: false, visible: false })),
      p: new THREE.Vector3(),
      l: new THREE.Vector3(),
    }),
    [],
  );
  const [sun, setSun] = useState<Vec3>(() => sunFor(0));
  const sunKey = useRef(-1);
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const smooth = useRef(0);

  useFrame((st, dt) => {
    // ease toward the scroll position so wheel-scrolling still feels continuous
    smooth.current = THREE.MathUtils.damp(smooth.current, progress.current ?? 0, 6, dt);
    const p = smooth.current;

    const s = sunFor(p);
    const key = Math.round(p * 120);
    if (key !== sunKey.current) {
      sunKey.current = key;
      setSun(s);
    }

    const info = frame(plan, p, state.trucks, state.units);

    // trucks + their ramps
    plan.trucks.forEach((pl, k) => {
      const ts = state.trucks[k];
      const g = truckRefs.current[k];
      if (g) {
        g.position.set(ts.x, 0, ts.z);
        g.rotation.y = ts.yaw;
        g.visible = ts.visible;
      }
      const down = rampDown(pl, p);
      for (const i of [0, 1]) {
        const r = rampRefs.current[k * 2 + i];
        if (r) r.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, RAMP_ANG, down);
      }
    });

    // units → swarm poses (panels follow the sun by `track`)
    const sp = trackingPose(s, 0);
    const list = poses.current;
    list.length = N;
    state.units.forEach((u, i) => {
      list[i] = {
        x: u.x,
        y: u.y,
        z: u.z,
        yaw: u.yaw,
        pitch: u.pitch,
        wheel: u.wheel,
        mast: u.mast,
        tilt: sp.tilt * u.track,
        azimuth: sp.azimuth * u.track,
        visible: u.visible,
        led: u.paired ? LED_PAIRED : LED_UNPAIRED,
      };
    });
    info.cassettes.forEach((c, k) => {
      const g = cassetteRefs.current[k];
      if (!g) return;
      g.visible = c.visible;
      g.position.set(c.x, c.y, c.z);
    });

    // the gate glows while units pass under it; swap ports pulse during a swap
    const on = THREE.MathUtils.smoothstep(p, PHASES.arrive[1] - 0.02, PHASES.arrive[1]);
    const pulse = 1.5 * Math.sin(st.clock.elapsedTime * 3);
    for (const m of portalLeds) m.emissiveIntensity = on * (5 + (info.crossing ? 9 : 0) + pulse);
    for (const m of swapLeds) m.emissiveIntensity = 4 + (info.swapping ? 10 : 0) + pulse;

    // camera: flyover, then over to the swap station
    const cu = camU(p);
    CAM_POS.getPoint(cu, state.p);
    CAM_LOOK.getPoint(cu, state.l);
    const k = toSwapCam(p);
    state.p.lerp(SWAP_CAM.pos, k);
    state.l.lerp(SWAP_CAM.look, k);
    camera.position.copy(state.p);
    camera.lookAt(state.l);
    // on wide screens, shift the image right so the action clears the caption column
    if (size.width > 900) camera.setViewOffset(size.width, size.height, -size.width * 0.17, 0, size.width, size.height);
    else camera.clearViewOffset();
  });

  return (
    <>
      <SunAndSky sun={sun} shadowSize={40} shadowTarget={[-4, 0, -6]} envFrames={Infinity} />
      <Ground kind="desert" />
      {trucks.slice(0, TRUCKS).map((t, k) => (
        <group
          key={k}
          ref={(g) => {
            truckRefs.current[k] = g;
          }}
          rotation-y={Math.PI}
          position={[0, 0, 120]}
          visible={false}
        >
          <primitive object={t} />
          <Ramps
            onRef={(i, g) => {
              rampRefs.current[k * 2 + i] = g;
            }}
          />
        </group>
      ))}
      {/* the flatbed that dropped the swap station, parked clear of the station and the return lane */}
      <group position={PARKED_TRUCK}>
        <primitive object={trucks[TRUCKS]} />
      </group>
      <group position={[0, 0, GATE_Z]}>
        <primitive object={portal} />
      </group>
      <group position={SWAP_POS}>
        <primitive object={swap} />
      </group>
      {plan.trips.map((t, k) => (
        <group
          key={t.unit}
          ref={(g) => {
            cassetteRefs.current[k] = g;
          }}
          visible={false}
        >
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.18, 0.6]} />
            <meshStandardMaterial color="#2f2e36" metalness={0.9} roughness={0.35} />
          </mesh>
          <mesh position={[0, -0.091, 0.17]}>
            <boxGeometry args={[0.09, 0.004, 0.02]} />
            <meshStandardMaterial color="#e0a36a" metalness={1} roughness={0.25} />
          </mesh>
        </group>
      ))}
      <Swarm max={N} poses={poses} />
    </>
  );
}

useGLTF.preload(MODELS.truck, DRACO);
useGLTF.preload(MODELS.portal, DRACO);
useGLTF.preload(MODELS.swap, DRACO);
