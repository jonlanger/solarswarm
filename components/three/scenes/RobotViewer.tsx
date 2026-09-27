"use client";

import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { Robot } from "../Robot";

/** Studio turntable of a single unit — homepage anatomy + app digital twin. */
export function RobotViewer({
  tilt = 0.5,
  azimuth = 2.6,
  mast = 0.12,
  ledColor,
  autoRotate = true,
  floor = "#0e0c14",
}: {
  tilt?: number;
  azimuth?: number;
  mast?: number;
  ledColor?: string;
  autoRotate?: boolean;
  floor?: string;
}) {
  const camera = useThree((s) => s.camera);
  // aim at the unit before the first frame (OrbitControls only takes over after mount)
  useLayoutEffect(() => camera.lookAt(0, 0.8, 0), [camera]);
  return (
    <>
      <color attach="background" args={[floor]} />
      <Environment resolution={256} frames={1} environmentIntensity={1.35}>
        <color attach="background" args={["#0b0a10"]} />
        <Lightformer form="rect" intensity={1.8} color="#fff4ea" position={[3, 4, 3]} scale={[4, 3, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2.4} color="#9d6bff" position={[-4, 2, -3]} scale={[3, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={2} color="#e0a36a" position={[4, 1, -4]} scale={[2, 2, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.5} color="#ffffff" position={[0, 6, 0]} scale={4} target={[0, 0, 0]} />
      </Environment>
      <ambientLight intensity={0.15} />
      <directionalLight position={[3, 5, 2]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
      <Robot tilt={tilt} azimuth={azimuth} mast={mast} ledColor={ledColor} />
      <ContactShadows position={[0, 0.001, 0]} opacity={0.75} scale={6} blur={2.4} far={2} color="#000000" />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color={floor} roughness={0.92} metalness={0} />
      </mesh>
      <OrbitControls
        makeDefault
        target={[0, 0.8, 0]}
        enablePan={false}
        minDistance={2.2}
        maxDistance={7}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2 - 0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        enableDamping
      />
    </>
  );
}
