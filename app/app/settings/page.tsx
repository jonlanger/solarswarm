"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";
import {
  ALargeSmall,
  Contrast,
  Eye,
  Focus,
  Gauge,
  Keyboard,
  Link2,
  Monitor,
  Moon,
  Pause,
  RotateCcw,
  Sun,
  Type,
  Waves,
} from "lucide-react";
import { PageHeader } from "@/components/app/AppShell";
import { Panel } from "@/components/app/widgets";
import { Button, Segmented, Select, StatusPill, Toggle, type RobotStatus, type SelectOption } from "@/components/ui";
import { useA11y, type FontChoice, type Palette } from "@/lib/a11y/settings";
import { useSim } from "@/lib/sim/store";

const FONTS: SelectOption<FontChoice>[] = [
  { value: "geist", label: "Geist", description: "SolarSwarm default" },
  { value: "hyperlegible", label: "Atkinson Hyperlegible", description: "Distinct letterforms for low vision" },
];

const PALETTES: SelectOption<Palette>[] = [
  { value: "default", label: "SolarSwarm", description: "Brand violet and copper" },
  { value: "cvd", label: "Colour-blind safe", description: "Okabe–Ito hues for protan, deutan and tritan vision" },
];

const SPEEDS: SelectOption<number>[] = [1, 60, 600, 3600].map((v) => ({
  value: v,
  label: v === 1 ? "Real time (1×)" : `${v}×`,
  description: v === 1 ? undefined : `${v === 3600 ? "1 hour" : `${v / 60} minutes`} of simulation per second`,
}));

/** One labelled preference: text on the left, control on the right (stacked on phones). */
function Row({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children: (ids: { labelId: string; descId: string }) => React.ReactNode;
}) {
  const id = useId();
  const labelId = `${id}-l`;
  const descId = `${id}-d`;
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 gap-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-surface-2 text-muted [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <div id={labelId} className="text-sm font-medium">
            {title}
          </div>
          <p id={descId} className="mt-0.5 text-[0.8125rem] text-muted">
            {description}
          </p>
        </div>
      </div>
      <div className="shrink-0 pl-11 sm:pl-0">{children({ labelId, descId })}</div>
    </div>
  );
}

export default function SettingsPage() {
  const a = useA11y();
  const { theme, setTheme } = useTheme();
  const speed = useSim((s) => s.speed);
  const setSpeed = useSim((s) => s.setSpeed);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Display and accessibility preferences. Saved on this device and applied across the platform and website."
        actions={
          <Button variant="outline" size="sm" onClick={a.reset}>
            <RotateCcw className="size-4" /> Reset to defaults
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="space-y-4 min-w-0">
          <Panel title="Appearance" bodyClass="divide-y divide-border">
            <Row icon={<Monitor />} title="Theme" description="Follow your device, or pick light or dark.">
              {() => (
                <Segmented
                  label="Theme"
                  value={mounted ? (theme ?? "system") : "system"}
                  onChange={setTheme}
                  options={[
                    { value: "system", label: "System", icon: <Monitor /> },
                    { value: "light", label: "Light", icon: <Sun /> },
                    { value: "dark", label: "Dark", icon: <Moon /> },
                  ]}
                />
              )}
            </Row>
            <Row icon={<ALargeSmall />} title="Text size" description="Scales text and spacing throughout the interface.">
              {() => (
                <Segmented
                  label="Text size"
                  value={a.textSize}
                  onChange={(v) => a.set("textSize", v)}
                  options={[
                    { value: "default", label: "Default" },
                    { value: "large", label: "Large" },
                    { value: "xlarge", label: "Larger" },
                  ]}
                />
              )}
            </Row>
            <Row icon={<Type />} title="Typeface" description="Switch to a typeface designed for legibility.">
              {() => (
                <Select
                  label="Typeface"
                  hideLabel
                  align="end"
                  className="w-full sm:w-56"
                  value={a.font}
                  onChange={(v) => a.set("font", v)}
                  options={FONTS}
                />
              )}
            </Row>
          </Panel>

          <Panel title="Vision" bodyClass="divide-y divide-border">
            <Row icon={<Contrast />} title="Contrast" description="Increase contrast of secondary text, borders and status colours.">
              {() => (
                <Segmented
                  label="Contrast"
                  value={a.contrast}
                  onChange={(v) => a.set("contrast", v)}
                  options={[
                    { value: "system", label: "System" },
                    { value: "more", label: "More" },
                    { value: "standard", label: "Standard" },
                  ]}
                />
              )}
            </Row>
            <Row
              icon={<Eye />}
              title="Status & chart colours"
              description="Robot statuses always carry an icon and label; this also changes their hues."
            >
              {() => (
                <Select
                  label="Status and chart colours"
                  hideLabel
                  align="end"
                  className="w-full sm:w-56"
                  value={a.palette}
                  onChange={(v) => a.set("palette", v)}
                  options={PALETTES}
                />
              )}
            </Row>
            <Row icon={<Link2 />} title="Underline links" description="Show links with an underline, not just colour.">
              {({ labelId, descId }) => (
                <Toggle checked={a.underlineLinks} onChange={(v) => a.set("underlineLinks", v)} labelledBy={labelId} describedBy={descId} />
              )}
            </Row>
            <Row icon={<Focus />} title="Prominent focus ring" description="A thicker, high-contrast outline around the focused control.">
              {({ labelId, descId }) => (
                <Toggle checked={a.boldFocus} onChange={(v) => a.set("boldFocus", v)} labelledBy={labelId} describedBy={descId} />
              )}
            </Row>
          </Panel>

          <Panel title="Motion & live data" bodyClass="divide-y divide-border">
            <Row
              icon={<Waves />}
              title="Motion"
              description="Reduce replaces animated 3D scenes with still images and removes transitions."
            >
              {() => (
                <Segmented
                  label="Motion"
                  value={a.motion}
                  onChange={(v) => a.set("motion", v)}
                  options={[
                    { value: "system", label: "System" },
                    { value: "reduce", label: "Reduce" },
                    { value: "full", label: "Full" },
                  ]}
                />
              )}
            </Row>
            <Row
              icon={<Pause />}
              title="Pause live updates"
              description="Freeze the simulated clock so numbers, charts and the map stop changing."
            >
              {({ labelId, descId }) => (
                <Toggle checked={a.pauseLive} onChange={(v) => a.set("pauseLive", v)} labelledBy={labelId} describedBy={descId} />
              )}
            </Row>
            <Row icon={<Gauge />} title="Simulation speed" description="How fast simulated time runs while live.">
              {() => (
                <Select
                  label="Simulation speed"
                  hideLabel
                  align="end"
                  className="w-full sm:w-56"
                  value={speed}
                  onChange={setSpeed}
                  options={SPEEDS}
                  disabled={a.pauseLive}
                />
              )}
            </Row>
          </Panel>
        </div>

        <div className="space-y-4 min-w-0 xl:sticky xl:top-20">
          <Panel title="Preview">
            <div className="space-y-3">
              <p className="text-sm">
                Fleet availability is <span className="font-mono tabular font-semibold">98.7%</span> across{" "}
                <a href="#" onClick={(e) => e.preventDefault()} className="text-primary">
                  3 sites
                </a>
                .
              </p>
              <p className="text-[0.8125rem] text-muted">Secondary text sits at this contrast.</p>
              <div className="flex flex-wrap gap-2">
                {(["tracking", "charging", "moving", "docked", "fault"] as RobotStatus[]).map((s) => (
                  <StatusPill key={s} status={s} />
                ))}
              </div>
              <div className="flex h-2 overflow-hidden rounded-full gap-[2px]" aria-hidden>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex-1" style={{ background: `var(--chart-${i})` }} />
                ))}
              </div>
            </div>
          </Panel>
          <Panel title="Keyboard">
            <ul className="space-y-2.5 text-[0.8125rem] text-muted">
              {[
                ["Tab", "Move between controls; the first stop is “Skip to content”"],
                ["↑ ↓", "Move through menus, lists and dropdown options"],
                ["← →", "Switch segmented controls and tabs"],
                ["A–Z", "Jump to a matching option in a dropdown"],
                ["Esc", "Close a menu, dropdown, drawer or panel"],
              ].map(([k, d]) => (
                <li key={k} className="flex gap-3">
                  <kbd className="h-6 min-w-10 shrink-0 rounded-[var(--radius-xs)] border border-border bg-surface-2 px-1.5 text-center font-mono text-xs leading-6 text-text">
                    {k}
                  </kbd>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-start gap-2 text-xs text-subtle">
              <Keyboard className="size-3.5 mt-px shrink-0" />
              Every control is reachable by keyboard and labelled for screen readers.
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
