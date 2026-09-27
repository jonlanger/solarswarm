"use client";

import { Canvas, type CanvasProps } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { cn } from "@/lib/cn";

/**
 * Canvas wrapper: lazy-mounts when scrolled near, shows a poster until the first frame,
 * respects reduced motion (poster only), and adapts DPR to performance.
 */
export function Stage({
  children,
  poster,
  posterAlt = "",
  className,
  camera,
  effects = true,
  ao = true,
  frameloop = "always",
  eager = false,
}: {
  children: React.ReactNode;
  poster?: string;
  posterAlt?: string;
  className?: string;
  camera?: CanvasProps["camera"];
  effects?: boolean;
  ao?: boolean;
  frameloop?: CanvasProps["frameloop"];
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [inView, setInView] = useState(eager);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!ref.current) return;
    // mount once near the viewport; pause rendering whenever off-screen
    const io = new IntersectionObserver(
      ([e]) => {
        setInView(e.isIntersecting);
        if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={posterAlt}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-700",
            ready && !reduced ? "opacity-0" : "opacity-100",
          )}
        />
      )}
      {visible && !reduced && (
        <Canvas
          className={cn("!absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
          shadows="soft"
          dpr={dpr}
          frameloop={inView ? frameloop : "never"}
          camera={camera ?? { position: [4, 2, 6], fov: 35, near: 0.1, far: 6000 }}
          gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
          onCreated={() => requestAnimationFrame(() => setTimeout(() => setReady(true), 250))}
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
      )}
    </div>
  );
}
