"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Stage } from "@/components/three/Stage";
import { cn } from "@/lib/cn";

const DeployScene = dynamic(() => import("@/components/three/scenes/DeployScene").then((m) => m.DeployScene), {
  ssr: false,
});

const STEPS = [
  {
    k: "01",
    t: "Delivered by flatbed",
    d: "One truck carries a full micro-array. No cranes, no pile drivers. The ramp drops and units roll off on their own.",
    at: 0,
  },
  {
    k: "02",
    t: "Pair at the portal",
    d: "Each unit drives through the SolarSwarm portal, authenticates, syncs firmware and joins the site mesh. Its light turns from copper to violet.",
    at: 0.13,
  },
  {
    k: "03",
    t: "Drive into formation",
    d: "The swarm plans spacing from the site survey (row pitch, shading and slope) and each robot drives to its slot.",
    at: 0.42,
  },
  {
    k: "04",
    t: "Raise, unfold, track",
    d: "Masts extend, panels unlock and the whole array starts following the sun. Energized the same week.",
    at: 0.72,
  },
];

export function DeploySection() {
  const ref = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const on = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / total));
      progress.current = p;
      setPct(p);
      let s = 0;
      STEPS.forEach((st, i) => p >= st.at && (s = i));
      setStep(s);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  return (
    <section id="deploy" ref={ref} className="relative h-[520vh] bg-violet-950">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <Stage
          poster="/renders/onboarding.jpg"
          posterAlt="Robots rolling off a flatbed truck through the pairing portal"
          className="absolute inset-0"
          camera={{ position: [10, 2.2, 22], fov: 40, near: 0.1, far: 6000 }}
        >
          <DeployScene progress={progress} />
        </Stage>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(20_6_47/0.85)_0%,rgb(20_6_47/0.45)_30%,transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgb(20_6_47/0.9)_0%,rgb(20_6_47/0.4)_45%,transparent_70%)] sm:hidden" />

        <div className="relative z-10 mx-auto max-w-7xl h-full px-4 sm:px-6 pb-8 sm:pb-0 flex flex-col justify-end sm:justify-center text-white">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-copper-300">From truck to field</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight max-w-md leading-[1.05]">
            Watch a solar field deploy itself.
          </h2>
          <ol className="mt-6 sm:mt-10 space-y-2 sm:space-y-3 max-w-sm">
            {STEPS.map((s, i) => (
              <li
                key={s.k}
                className={cn(
                  "rounded-[var(--radius-md)] p-4 transition-all duration-500",
                  i === step ? "glass !bg-white/10 !border-white/15 opacity-100" : "opacity-45",
                )}
              >
                <div className="flex items-baseline gap-3">
                  <span className={cn("font-mono text-xs", i === step ? "text-copper-300" : "text-white/50")}>
                    {s.k}
                  </span>
                  <span className="font-medium">{s.t}</span>
                </div>
                <p
                  className={cn(
                    "text-sm text-white/70 pl-8 overflow-hidden transition-all duration-500",
                    i === step ? "max-h-32 mt-1.5" : "max-h-0",
                  )}
                >
                  {s.d}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-8 h-1 w-full max-w-sm rounded-full bg-white/10 overflow-hidden" aria-hidden>
            <div className="h-full bg-swarm" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
