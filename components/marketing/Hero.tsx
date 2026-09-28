"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Stage } from "@/components/three/Stage";
import { buttonClass } from "@/components/ui";
import { renderUrl } from "@/lib/renders";

const HeroScene = dynamic(() => import("@/components/three/scenes/HeroScene").then((m) => m.HeroScene), {
  ssr: false,
});

export function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[680px] overflow-hidden bg-violet-950 text-white">
      <Stage
        eager
        poster={renderUrl("hero")}
        posterAlt="SolarSwarm robot tracking the sun at golden hour in front of a deployed array"
        className="absolute inset-0"
        camera={{ position: [2.7, 0.72, -3.9], fov: 38, near: 0.1, far: 6000 }}
      >
        <HeroScene />
      </Stage>
      {/* legibility gradients in brand violet */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(20_6_47/0.92)_0%,rgb(20_6_47/0.72)_32%,rgb(42_14_97/0.18)_62%,transparent_80%)]" />
      <div className="pointer-events-none absolute inset-0 bg-violet-950/55 sm:hidden" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-violet-950/85 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl h-full px-4 sm:px-6 flex flex-col justify-center pt-16">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 h-7 pl-1 pr-3 rounded-full glass !bg-white/10 !border-white/15 text-[12.5px] text-white/85">
            <span className="h-5 px-2 rounded-full bg-copper text-[#2a1606] font-semibold text-[11px] inline-flex items-center">
              NEW
            </span>
            Swarm OS 2.0: predictive maintenance for every unit
          </div>
          <h1 className="mt-6 text-[44px] sm:text-6xl lg:text-[76px] leading-[0.98] font-semibold tracking-[-0.035em]">
            Solar fields that
            <br />
            <span className="bg-[linear-gradient(100deg,#d9c7ff,#9d6bff_45%,#e0a36a)] bg-clip-text text-transparent">
              deploy themselves.
            </span>
          </h1>
          <p className="mt-6 text-lg text-white/75 max-w-md leading-relaxed">
            Autonomous robots arrive on a truck, drive into formation and follow the sun all day. No racking,
            no trenching, no 200-person crew. Just power, on site, in days.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/app/onboarding" className={buttonClass("copper", "lg")}>
              Deploy a field <ArrowRight className="size-4" />
            </Link>
            <Link
              href="#deploy"
              className={buttonClass("ghost", "lg", "text-white hover:bg-white/10 border border-white/20")}
            >
              <Play className="size-4" /> Watch it deploy
            </Link>
          </div>
        </div>

        <dl className="mt-auto mb-12 grid grid-cols-2 md:grid-cols-4 gap-px rounded-[var(--radius-lg)] overflow-hidden glass !bg-white/[0.06] !border-white/10 max-w-3xl">
          {[
            ["3 days", "from truck to energized"],
            ["+31%", "yield vs. fixed tilt"],
            ["0", "piles, trenches or racking"],
            ["24/7", "fleet monitoring"],
          ].map(([v, l]) => (
            <div key={l} className="px-5 py-4 bg-white/[0.02]">
              <dt className="sr-only">{l}</dt>
              <dd className="font-mono tabular text-2xl font-semibold tracking-tight">{v}</dd>
              <dd className="text-[12.5px] text-white/60 mt-1">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
