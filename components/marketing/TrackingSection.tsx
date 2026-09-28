"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Stage } from "@/components/three/Stage";
import { ChartTooltip, Legend, axisProps, gridProps, hourLabel } from "@/components/charts/chart-theme";
import { irradiance, localMidnight, pointAt, simulateDay } from "@/lib/sim/energy";
import { SITES } from "@/lib/sim/model";
import { Card } from "@/components/ui";
import { renderUrl } from "@/lib/renders";

const TrackingScene = dynamic(() => import("@/components/three/scenes/TrackingScene").then((m) => m.TrackingScene), {
  ssr: false,
});

const SITE = SITES[0]; // Mojave Flats

export function TrackingSection() {
  const [hour, setHour] = useState(9.5);
  // Server HTML is prerendered at build time, so render a fixed reference day first and switch to the
  // visitor's today after mount — otherwise the time-dependent readouts break hydration (React #418).
  const [today, setToday] = useState(() => new Date("2026-06-21T12:00:00Z"));
  useEffect(() => setToday(new Date()), []);
  const day = useMemo(() => simulateDay(SITE, today, 1, { derate: 0.92 }), [today]);
  const t = localMidnight(today, SITE.timezone).getTime() + hour * 3600_000;
  const irr = irradiance(SITE, new Date(t));
  const pt = pointAt(day, t);
  const data = useMemo(
    () =>
      day.points
        .filter((p) => p.hour >= 5 && p.hour <= 20)
        .map((p) => ({ hour: p.hour, tracking: p.solarKw * 1000, fixed: p.fixedKw * 1000 })),
    [day],
  );
  const gainNow = pt.fixedKw > 0.001 ? pt.solarKw / pt.fixedKw - 1 : 0;

  return (
    <section id="tracking" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent-text">Follows the sun</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
            Every panel faces the sun, all day long.
          </h2>
          <p className="mt-5 text-lg text-muted">
            Each unit runs a dual-axis gimbal driven by the real solar ephemeris for its exact GPS position. Drag
            the clock to see today&apos;s sun at {SITE.name} and what tracking earns over a fixed-tilt panel.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="relative rounded-[var(--radius-xl)] overflow-hidden border border-border bg-violet-950 aspect-[4/3] lg:aspect-auto lg:min-h-[520px]">
            <Stage
              poster={renderUrl("hero")}
              className="absolute inset-0"
              camera={{ position: [5.2, 2.1, 7.4], fov: 42, near: 0.1, far: 6000 }}
            >
              <TrackingScene sun={irr.sun} latitude={SITE.lat} />
            </Stage>
            <div className="absolute left-4 right-4 bottom-4 glass rounded-[var(--radius-md)] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Local time · {SITE.region}</span>
                <span className="font-mono tabular font-semibold">{hourLabel(Math.round(hour * 4) / 4)}</span>
              </div>
              <input
                aria-label="Time of day"
                type="range"
                min={5}
                max={20}
                step={0.05}
                value={hour}
                onChange={(e) => setHour(parseFloat(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)] cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-[11px] text-subtle font-mono">
                <span>5am</span>
                <span>noon</span>
                <span>8pm</span>
              </div>
            </div>
          </div>

          <Card className="p-5 sm:p-6 flex flex-col">
            <div className="grid grid-cols-3 gap-3">
              <Readout label="Sun elevation" value={`${Math.max(0, (irr.altitude * 180) / Math.PI).toFixed(1)}°`} />
              <Readout label="Panel output" value={`${Math.round(pt.solarKw * 1000)} W`} accent />
              <Readout
                label="vs fixed tilt"
                value={pt.fixedKw > 0.005 ? `${gainNow >= 0 ? "+" : ""}${Math.round(gainNow * 100)}%` : "—"}
              />
            </div>
            <div className="mt-6 flex items-end justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Output per unit, today</div>
                <div className="text-xs text-muted mt-0.5">
                  {(day.solarKwh).toFixed(2)} kWh tracking vs {(day.fixedKwh).toFixed(2)} kWh fixed ·{" "}
                  <span className="text-text font-medium">+{Math.round(day.trackingGain * 100)}% daily yield</span>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <Legend
                items={[
                  { label: "SolarSwarm tracking", color: "var(--chart-1)" },
                  { label: "Fixed tilt (reference)", color: "var(--text-subtle)", dashed: true },
                ]}
              />
            </div>
            <div className="mt-2 h-60 -mx-2 flex-1 min-h-60">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="trk" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.3} />
                      <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="hour" type="number" domain={[5, 20]} ticks={[6, 9, 12, 15, 18]} tickFormatter={hourLabel} {...axisProps} />
                  <YAxis {...axisProps} width={52} tickFormatter={(v) => `${v}W`} />
                  <Tooltip
                    content={<ChartTooltip labelFormatter={hourLabel} unit=" W" digits={0} />}
                    cursor={{ stroke: "var(--border-strong)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tracking"
                    name="Tracking"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#trk)"
                    isAnimationActive={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fixed"
                    name="Fixed tilt"
                    stroke="var(--text-subtle)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <ReferenceLine x={hour} stroke="var(--accent)" strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-surface-2 px-3 py-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`font-mono tabular text-lg font-semibold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
