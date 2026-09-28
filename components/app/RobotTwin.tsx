"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Cpu, Gauge, MapPin, Thermometer, WavesHorizontal, Zap } from "lucide-react";
import { Stage } from "@/components/three/Stage";
import { BatteryGauge, Badge, StatusPill, buttonClass, statusMeta } from "@/components/ui";
import { fmt } from "@/lib/sim/energy";
import { getSite, type RobotLive } from "@/lib/sim/store";
import { RiskDial } from "./widgets";

const RobotViewer = dynamic(() => import("@/components/three/scenes/RobotViewer").then((m) => m.RobotViewer), {
  ssr: false,
});

const LED: Record<RobotLive["status"], string> = {
  tracking: "#9d6bff",
  charging: "#e0a36a",
  moving: "#5aa6ff",
  docked: "#6b6580",
  fault: "#ff4d55",
};

/** Live 3D twin: the GLB rig posed from telemetry (tilt / azimuth / LED colour). */
export function TwinCanvas({ r, className }: { r: RobotLive; className?: string }) {
  return (
    <Stage
      eager
      className={className}
      camera={{ position: [3.4, 2.0, 3.7], fov: 35, near: 0.1, far: 100 }}
      ao={false}
    >
      <RobotViewer
        tilt={r.tilt}
        azimuth={r.azimuth}
        mast={r.status === "tracking" ? 0.12 : -0.1}
        ledColor={LED[r.status]}
        floor="#0e0c14"
      />
    </Stage>
  );
}

export function Telemetry({ r }: { r: RobotLive }) {
  const h = r.unit.health;
  const rows = [
    { Icon: Zap, k: "Output", v: `${Math.round(r.powerW)} W`, of: `${r.unit.ratedW} W rated` },
    { Icon: Gauge, k: "Panel", v: `${Math.round((r.tilt * 180) / Math.PI)}° tilt`, of: `${Math.round(((r.azimuth * 180) / Math.PI + 360) % 360)}° azimuth` },
    { Icon: Thermometer, k: "Drive motor", v: `${h.motorTemp.toFixed(1)} °C`, of: "limit 85 °C" },
    { Icon: WavesHorizontal, k: "Bearing vibration", v: `${h.vibration.toFixed(2)} mm/s`, of: "alert 4.5 mm/s" },
    { Icon: Cpu, k: "Tilt actuator", v: `${h.actuatorCurrent.toFixed(2)} A`, of: "nominal 1.1 A" },
    { Icon: MapPin, k: "Soiling loss", v: fmt.pct(h.soiling), of: "wash at 8%" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(({ Icon, k, v, of }) => (
        <div key={k} className="rounded-[var(--radius-md)] bg-surface-2 p-3">
          <div className="flex items-center gap-1.5 text-[0.6875rem] text-muted">
            <Icon className="size-3.5" />
            {k}
          </div>
          <div className="font-mono tabular text-[0.9375rem] font-semibold mt-1">{v}</div>
          <div className="text-[0.6875rem] text-subtle">{of}</div>
        </div>
      ))}
    </div>
  );
}

export function RobotSummary({ r, link = true }: { r: RobotLive; link?: boolean }) {
  const site = getSite(r.unit.siteId);
  const p = r.unit.prediction;
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-lg font-semibold">{r.unit.id}</div>
          <div className="text-sm text-muted">
            {site?.name} · row {r.unit.row + 1}, slot {r.unit.col + 1}
          </div>
        </div>
        <StatusPill status={r.status} />
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted mb-1.5">
          <span>Battery · {fmt.pct(r.unit.health.batteryHealth, 0)} state of health</span>
        </div>
        <BatteryGauge value={r.soc * 100} />
      </div>
      <Telemetry r={r} />
      <div className="rounded-[var(--radius-md)] border border-border p-4 flex items-center gap-4">
        <RiskDial value={r.unit.risk} />
        <div className="text-sm min-w-0">
          <div className="font-medium">Predictive health</div>
          <div className="text-muted text-xs mt-0.5">
            {p
              ? `${p.component}: ${p.days === 0 ? "fault now" : `failure likely in ~${p.days} days`} (${fmt.pct(p.confidence, 0)} confidence)`
              : "No anomalies. Next inspection in 42 days."}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <Badge>{r.unit.firmware}</Badge>
        <Badge>{fmt.int(r.unit.hours)} h runtime</Badge>
        <Badge tone={statusMeta[r.status].tone}>LED {statusMeta[r.status].label.toLowerCase()}</Badge>
      </div>
      {link && (
        <Link href={`/app/robots/${r.unit.id}`} className={buttonClass("outline", "md", "w-full")}>
          Open unit details
        </Link>
      )}
    </div>
  );
}
