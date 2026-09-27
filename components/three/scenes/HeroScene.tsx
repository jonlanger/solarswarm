"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sunVectorFromAngles, trackingPose } from "@/lib/sun";
import { Robot, type Vec3 } from "../Robot";
import { Swarm, type SwarmPose } from "../Swarm";
import { GrassField, Ground, SunAndSky } from "../World";

const deg = THREE.MathUtils.degToRad;

/** Golden-hour sun drifting slowly so the panels visibly track it. */
function sunAt(t: number): Vec3 {
  const k = (Math.sin(t * 0.05) + 1) / 2;
  return sunVectorFromAngles(deg(-128 + 30 * k), deg(9 + 14 * k));
}

export function HeroScene() {
  const [sun, setSun] = useState<Vec3>(() => sunAt(0));
  const poses = useRef<SwarmPose[]>([]);
  const camera = useThree((s) => s.camera as THREE.PerspectiveCamera);
  const size = useThree((s) => s.size);
  const pointer = useThree((s) => s.pointer);
  const look = useMemo(() => new THREE.Vector3(-0.2, 1.0, 0.6), []);

  const grid = useMemo(() => {
    const out: { x: number; z: number; lag: number }[] = [];
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 17; c++) {
        const x = -19 + c * 2.35 + (r % 2) * 0.2;
        const z = 5.5 + r * 2.9;
        if (Math.abs(x) < 2.5 && r < 1) continue;
        out.push({ x, z, lag: ((c * 7 + r * 13) % 11) / 11 });
      }
    return out;
  }, []);

  const lastSun = useRef(0);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const s = sunAt(t);
    // update React state (light/sky) only a few times a second
    if (t - lastSun.current > 0.25) {
      lastSun.current = t;
      setSun(s);
    }
    // swarm follows the sun with a small per-unit lag
    poses.current = grid.map((g) => {
      const sl = sunAt(t - g.lag * 3);
      const p = trackingPose(sl, 0);
      return { x: g.x, z: g.z, yaw: 0, tilt: p.tilt, azimuth: p.azimuth, mast: 0.1 };
    });
    // parallax camera
    const tx = 2.7 + pointer.x * 0.5;
    const ty = 0.72 + pointer.y * 0.18;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 2, dt);
    camera.position.z = -3.9;
    camera.lookAt(look);
    // push the hero unit into the right-hand side on wide screens, clear of the headline
    if (size.width > 900) camera.setViewOffset(size.width, size.height, -size.width * 0.2, 0, size.width, size.height);
    else camera.clearViewOffset();
  });

  return (
    <>
      <SunAndSky sun={sun} shadowSize={36} shadowTarget={[0, 0, 10]} envFrames={2} />
      <Ground kind="grass" />
      <GrassField count={60000} radius={18} />
      <Robot trackSun={sun} yaw={deg(-8)} mast={0.1} damping={2} />
      <Swarm max={grid.length} poses={poses} />
    </>
  );
}
