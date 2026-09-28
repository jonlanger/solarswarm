"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Navigation, Power, RotateCcw, Truck } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/app/AppShell";
import { RobotSummary, TwinCanvas } from "@/components/app/RobotTwin";
import { Panel } from "@/components/app/widgets";
import { ChartTooltip, axisProps, gridProps } from "@/components/charts/chart-theme";
import { Button, Card } from "@/components/ui";
import { mulberry32, ROBOTS } from "@/lib/sim/model";
import { getSite, liveRobots, useSim } from "@/lib/sim/store";

export default function RobotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const now = useSim((s) => s.now);
  const unit = ROBOTS.find((r) => r.id === id);
  const site = unit ? getSite(unit.siteId) : undefined;
  const live = useMemo(() => (site ? liveRobots(site, now).find((r) => r.unit.id === id) : undefined), [site, now, id]);
  const [action, setAction] = useState<string>();

  // 30-day health trend reconstructed from the unit's wear rates
  const trend = useMemo(() => {
    if (!unit) return [];
    const rnd = mulberry32(unit.row * 100 + unit.col);
    return Array.from({ length: 30 }, (_, i) => {
      const d = i / 29;
      return {
        day: i - 29,
        vibration: +(0.9 + unit.wear.bearing * 5.2 * (0.55 + 0.45 * d) + (rnd() - 0.5) * 0.25).toFixed(2),
        motor: +(10 + unit.wear.motor * 22 * (0.6 + 0.4 * d) + (rnd() - 0.5) * 1.5).toFixed(1),
      };
    });
  }, [unit]);

  if (!unit || !site || !live) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted">Unit {id} not found.</p>
        <Link href="/app/robots" className="text-primary text-sm mt-2 inline-block">
          Back to robots
        </Link>
      </Card>
    );
  }

  const actions = [
    { k: "locate", label: "Flash LEDs", Icon: Navigation },
    { k: "stow", label: "Stow panel", Icon: RotateCcw },
    { k: "service", label: "Send to service lane", Icon: Truck },
    { k: "reboot", label: "Reboot controller", Icon: Power },
  ];

  return (
    <>
      <Link href="/app/robots" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-3">
        <ArrowLeft className="size-4" /> Robots
      </Link>
      <PageHeader title={`Unit ${unit.id}`} subtitle={`${site.name} · ${site.region}`} />
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4 min-w-0">
          <Card className="overflow-hidden">
            <TwinCanvas r={live} className="h-[420px] bg-[#0e0c14]" />
            <div className="px-5 py-3 text-xs text-muted border-t border-border">
              Digital twin · panel pose, mast height and LED state mirror live telemetry. Drag to orbit.
            </div>
          </Card>
          <Panel title="Health trend · 30 days" subtitle="Motor temperature rise over ambient and bearing vibration">
            <div className="grid sm:grid-cols-2 gap-6">
              {(
                [
                  ["motor", "Motor Δ°C", "var(--chart-2)", " °C"],
                  ["vibration", "Vibration mm/s", "var(--chart-1)", " mm/s"],
                ] as const
              ).map(([key, label, color, unitLabel]) => (
                <div key={key}>
                  <div className="text-xs text-muted mb-1">{label}</div>
                  <div className="h-40 -ml-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="day" {...axisProps} tickFormatter={(d) => (d === 0 ? "today" : `${d}d`)} ticks={[-28, -21, -14, -7, 0]} />
                        <YAxis {...axisProps} width={36} />
                        <Tooltip content={<ChartTooltip labelFormatter={(d) => `${d} days`} unit={unitLabel} digits={2} />} />
                        <Line dataKey={key} name={label} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <RobotSummary r={live} link={false} />
          </Card>
          <Panel title="Remote actions">
            <div className="grid grid-cols-2 gap-2">
              {actions.map(({ k, label, Icon }) => (
                <Button key={k} variant="secondary" size="sm" onClick={() => setAction(label)} className="justify-start">
                  <Icon className="size-4" /> {label}
                </Button>
              ))}
            </div>
            {action && (
              <p className="mt-3 text-xs text-success" role="status">
                “{action}” queued for {unit.id}; the unit acknowledges within 2 s over the site mesh (simulated).
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
