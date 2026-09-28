"use client";

import type { CanvasProps } from "@react-three/fiber";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// three.js + R3F + postprocessing load in their own chunk, after the poster has painted
const StageCanvas = dynamic(() => import("./StageCanvas"), { ssr: false });

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
        // optimized (AVIF/WebP, responsive); the eager (above-the-fold) stage's poster is the LCP image
        <Image
          src={poster}
          alt={posterAlt}
          fill
          sizes="100vw"
          priority={eager}
          className={cn(
            "object-cover transition-opacity duration-700",
            ready && !reduced ? "opacity-0" : "opacity-100",
          )}
        />
      )}
      {visible && !reduced && (
        <StageCanvas
          camera={camera}
          effects={effects}
          ao={ao}
          frameloop={inView ? frameloop : "never"}
          ready={ready}
          onReady={() => setReady(true)}
        >
          {children}
        </StageCanvas>
      )}
    </div>
  );
}
