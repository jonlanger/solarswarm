"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { Robot, type Vec3 } from "../Robot";
import { GrassField, Ground, SunAndSky } from "../World";

const UNITS: [number, number][] = [
  [0, 0],
  [-2.4, -1.8],
  [2.4, -1.8],
  [-4.8, -3.6],
  [0, -3.6],
  [4.8, -3.6],
];

/** Fixed-tilt reference panel on a post (tilt = latitude, facing south = +Z). */
function FixedPanel({ position, tilt }: { position: Vec3; tilt: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 1.1, 16]} />
        <meshStandardMaterial color="#8d8f96" metalness={1} roughness={0.4} />
      </mesh>
      <group position={[0, 1.15, 0]} rotation-x={tilt}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.035, 1.65]} />
          <meshStandardMaterial color="#1b1830" metalness={0.2} roughness={0.15} />
        </mesh>
      </group>
      <Html position={[0, 2.35, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="whitespace-nowrap rounded-full bg-black/55 text-white/80 text-[11px] px-2.5 py-1 backdrop-blur">
          Fixed tilt
        </div>
      </Html>
    </group>
  );
}

export function TrackingScene({ sun, latitude }: { sun: Vec3; latitude: number }) {
  const camera = useThree((s) => s.camera);
  const look = useMemo(() => new THREE.Vector3(0.4, 1.0, -1.6), []);
  useFrame(({ pointer }, dt) => {
    camera.position.x = THREE.MathUtils.damp(camera.position.x, 5.2 + pointer.x * 0.6, 2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, 2.1 + pointer.y * 0.3, 2, dt);
    camera.position.z = 7.4; // south of the array, sun behind the camera
    camera.lookAt(look);
  });
  return (
    <>
      <SunAndSky sun={sun} shadowSize={14} shadowTarget={[0, 0, -1.5]} envFrames={Infinity} />
      <Ground kind="grass" />
      <GrassField count={26000} radius={11} center={[0, -1.5]} seed={3} />
      {UNITS.map(([x, z], i) => (
        <Robot key={i} lod={i > 0} position={[x, 0, z]} trackSun={sun} mast={0.12} damping={3.2} />
      ))}
      <FixedPanel position={[2.9, 0, 2.0]} tilt={(latitude * Math.PI) / 180} />
      <Html position={[0, 2.6, 0]} center distanceFactor={9} zIndexRange={[10, 0]}>
        <div className="whitespace-nowrap rounded-full bg-[#5b2bd9]/80 text-white text-[11px] px-2.5 py-1 backdrop-blur">
          SolarSwarm dual-axis
        </div>
      </Html>
    </>
  );
}
