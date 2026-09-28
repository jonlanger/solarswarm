"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/cn";

/** The WebGL half of <Stage/>, split out so three.js / R3F / postprocessing load after the poster paints. */
export default function StageCanvas({
  children,
  camera,
  effects,
  ao,
  frameloop,
  ready,
  onReady,
}: {
  children: React.ReactNode;
  camera?: CanvasProps["camera"];
  effects: boolean;
  ao: boolean;
  frameloop: CanvasProps["frameloop"];
  ready: boolean;
  onReady: () => void;
}) {
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      className={cn("!absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
      shadows="soft"
      dpr={dpr}
      frameloop={frameloop}
      camera={camera ?? { position: [4, 2, 6], fov: 35, near: 0.1, far: 6000 }}
      gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
      onCreated={() => requestAnimationFrame(() => setTimeout(onReady, 250))}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))} />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        {children}
        {effects ? (
          <EffectComposer multisampling={4}>
            {ao ? <N8AO aoRadius={0.6} intensity={1.4} distanceFalloff={0.6} halfRes /> : <></>}
            <Bloom mipmapBlur intensity={0.7} luminanceThreshold={1.0} luminanceSmoothing={0.2} />
            <ToneMapping mode={ToneMappingMode.AGX} />
            <Vignette offset={0.25} darkness={0.45} />
          </EffectComposer>
        ) : null}
      </Suspense>
    </Canvas>
  );
}
