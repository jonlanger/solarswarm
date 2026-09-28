"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowDownUp, Bell, Copy, Download, MapPin, MoreHorizontal, Pencil, Plus, Settings, Sun, Trash2, Zap } from "lucide-react";
import {
  Badge,
  BatteryGauge,
  Button,
  Card,
  CardBody,
  CardHeader,
  IconButton,
  Logo,
  Menu,
  RingGauge,
  Segmented,
  Select,
  Sparkline,
  StatTile,
  StatusPill,
  Stepper,
  Tabs,
  Toggle,
  type RobotStatus,
} from "@/components/ui";
import { renderUrl } from "@/lib/renders";

const RAMPS = [
  { name: "Violet (Swarm)", steps: ["950", "900", "800", "700", "600", "500", "400", "300", "200", "100", "50"], v: "violet" },
  { name: "Copper (Battery)", steps: ["900", "800", "700", "600", "500", "400", "300", "200", "100"], v: "copper" },
  { name: "Graphite", steps: ["975", "950", "900", "850", "800", "700", "500", "400", "200", "100"], v: "graphite" },
];

const SEMANTIC = [
  "--bg",
  "--surface",
  "--surface-2",
  "--border",
  "--text",
  "--text-muted",
  "--primary",
  "--accent",
  "--success",
  "--warning",
  "--danger",
  "--info",
];

const CHART = [
  ["--chart-1", "Solar generation"],
  ["--chart-2", "Battery / storage"],
  ["--chart-3", "Site load"],
  ["--chart-4", "Grid export"],
  ["--chart-5", "Grid import"],
  ["--chart-6", "Other"],
];

function Section({ id, title, children, lead }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-12 border-t border-border first:border-0">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {lead && <p className="text-muted mt-2 max-w-2xl">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  const [seg, setSeg] = useState("day");
  const [tab, setTab] = useState("overview");
  const [on, setOn] = useState(true);
  const [site, setSite] = useState("mojave");
  const [sort, setSort] = useState("risk");
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-28 pb-20">
      <div className="rounded-[var(--radius-xl)] bg-swarm text-white p-8 sm:p-12 relative overflow-hidden shadow-glow">
        <div className="absolute -right-20 -bottom-24 size-80 rounded-full bg-[radial-gradient(circle,rgb(224_163_106/0.6),transparent_65%)]" />
        <Logo className="text-white" />
        <h1 className="mt-6 text-4xl sm:text-5xl font-semibold tracking-tight">SolarSwarm Design System</h1>
        <p className="mt-3 text-white/75 max-w-xl">
          A purple &ldquo;swarm&rdquo; gradient for intelligence and motion, battery copper for energy and stored power,
          on graphite and paper neutrals, in light and dark. Toggle the theme in the header to see every token switch.
        </p>
      </div>

      <Section id="brand" title="Brand gradients" lead="Two signature gradients. Swarm (violet) leads; copper is the accent for energy, CTAs and highlights.">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["bg-swarm", "Swarm", "#2A0E61 → #5B2BD9 → #9D6BFF"],
            ["bg-copper", "Battery copper", "#7A4A1F → #B87333 → #EEC39A"],
            ["bg-dusk", "Dusk (hero skies)", "violet-950 → violet-800 → copper"],
          ].map(([cls, n, d]) => (
            <div key={n} className="rounded-[var(--radius-lg)] overflow-hidden border border-border bg-surface">
              <div className={`${cls} h-32`} />
              <div className="p-4">
                <div className="font-medium">{n}</div>
                <div className="text-xs text-muted font-mono mt-1">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="color" title="Color ramps">
        <div className="space-y-5">
          {RAMPS.map((r) => (
            <div key={r.name}>
              <div className="text-sm font-medium mb-2">{r.name}</div>
              <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5">
                {r.steps.map((s) => (
                  <div key={s}>
                    <div className="h-14 rounded-[var(--radius-sm)] border border-border" style={{ background: `var(--${r.v}-${s})` }} />
                    <div className="text-[0.6875rem] text-muted font-mono mt-1">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="semantic" title="Semantic tokens" lead="Components only use semantic tokens; each is redefined for dark mode, not auto-inverted.">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {SEMANTIC.map((t) => (
            <div key={t} className="rounded-[var(--radius-md)] border border-border overflow-hidden bg-surface">
              <div className="h-12" style={{ background: `var(${t})` }} />
              <div className="px-2.5 py-2 text-xs font-mono text-muted">{t}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="data"
        title="Data visualization palette"
        lead="Fixed categorical order, validated for lightness band, chroma, colour-vision-deficiency separation and 3:1 contrast in both themes. Each series has a permanent meaning across the product."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CHART.map(([t, l]) => (
            <div key={t} className="rounded-[var(--radius-md)] border border-border bg-surface p-3">
              <div className="h-2 rounded-full" style={{ background: `var(${t})` }} />
              <div className="text-sm mt-3">{l}</div>
              <div className="text-[0.6875rem] text-muted font-mono">{t}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(["tracking", "charging", "moving", "docked", "fault"] as RobotStatus[]).map((s) => (
            <StatusPill key={s} status={s} />
          ))}
          <span className="text-xs text-muted self-center ml-2">Robot status colours are reserved and always paired with an icon and label.</span>
        </div>
      </Section>

      <Section id="type" title="Typography" lead="Geist for interface and display, Geist Mono for telemetry numerals.">
        <div className="space-y-4">
          <div className="text-6xl font-semibold tracking-[-0.035em]">Deploy themselves.</div>
          <div className="text-4xl font-semibold tracking-tight">Every panel faces the sun</div>
          <div className="text-2xl font-semibold tracking-tight">Fleet availability</div>
          <div className="text-lg text-muted">Body large: autonomous robots arrive on a truck and drive into formation.</div>
          <div className="text-sm">Body: interface text, table cells, descriptions.</div>
          <div className="font-mono tabular text-2xl">412.6 kW · 98.7% · SS-10238</div>
        </div>
      </Section>

      <Section id="components" title="Components">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Buttons" subtitle="Primary (swarm), copper, secondary, outline, ghost, danger" />
            <CardBody className="flex flex-wrap gap-2">
              <Button>Deploy a field</Button>
              <Button variant="copper">Plan deployment</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Stop unit</Button>
              <Button size="sm">
                <Plus className="size-4" /> Small
              </Button>
              <IconButton label="Notifications" variant="outline">
                <Bell className="size-4" />
              </IconButton>
              <IconButton label="Settings">
                <Settings className="size-4" />
              </IconButton>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Badges & status" />
            <CardBody className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="primary">Primary</Badge>
              <Badge tone="copper">Copper</Badge>
              <Badge tone="success">Healthy</Badge>
              <Badge tone="warning">Due soon</Badge>
              <Badge tone="danger">Urgent</Badge>
              <Badge tone="info">Info</Badge>
            </CardBody>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <StatTile label="Solar now" value="412.6" unit="kW" delta={4.2} icon={<Sun className="size-4" />} spark={[2, 4, 8, 14, 18, 21, 20, 17, 11, 6, 3]} />
            <StatTile label="Grid import" value="38" unit="kWh" delta={-12} deltaGoodWhen="down" icon={<Zap className="size-4" />} spark={[9, 7, 6, 4, 3, 5, 4, 3]} sparkColor="var(--chart-5)" />
          </div>
          <Card>
            <CardHeader title="Gauges" />
            <CardBody className="flex flex-wrap items-center gap-6 sm:gap-8">
              <RingGauge value={99.2} label="availability" />
              <RingGauge value={71} label="state of charge" color="var(--accent)" />
              <div className="flex-1 min-w-[10rem] space-y-3">
                <BatteryGauge value={86} />
                <BatteryGauge value={24} />
                <BatteryGauge value={9} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Navigation & inputs" subtitle="Segmented controls and tabs use roving focus: Tab in, arrow keys to switch." />
            <CardBody className="space-y-5">
              <Segmented label="Range" value={seg} onChange={setSeg} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
              <Tabs label="Robot detail" value={tab} onChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "energy", label: "Energy" }, { value: "health", label: "Health" }]} />
              <Toggle checked={on} onChange={setOn} label="Generation heatmap" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Select & menu"
              subtitle="Our own listbox and action menu. Never the browser's native popup, so they match the theme on every OS."
            />
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Site"
                  icon={<MapPin />}
                  value={site}
                  onChange={setSite}
                  options={[
                    { value: "mojave", label: "Mojave Flats", description: "San Bernardino County, CA" },
                    { value: "permian", label: "Permian Pump Station 7", description: "Midland Basin, TX" },
                    { value: "piedmont", label: "Piedmont Dairy", description: "Rowan County, NC" },
                    { value: "closed", label: "Kern Ridge", description: "Decommissioned", disabled: true },
                  ]}
                />
                <Select
                  label="Sort"
                  size="sm"
                  icon={<ArrowDownUp />}
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "risk", label: "Risk (highest first)" },
                    { value: "output", label: "Output (highest first)" },
                    { value: "battery", label: "Battery (lowest first)" },
                  ]}
                />
              </div>
              <div className="flex items-center gap-3">
                <Menu
                  label="Unit actions"
                  align="start"
                  triggerClassName="border border-border-strong"
                  items={[
                    { label: "Rename", icon: <Pencil />, hint: "R" },
                    { label: "Duplicate layout", icon: <Copy /> },
                    { label: "Export telemetry", icon: <Download /> },
                    { separator: true },
                    { label: "Decommission", icon: <Trash2 />, danger: true },
                  ]}
                >
                  <MoreHorizontal className="size-4" />
                </Menu>
                <span className="text-xs text-muted">
                  Keyboard: arrows, Home/End, type-ahead, Enter, Esc. Phones get a bottom sheet with 48px rows.
                </span>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Stepper & sparkline" />
            <CardBody className="space-y-6">
              <Stepper steps={["Register", "Site", "Layout", "Deploy"]} current={2} />
              <Sparkline data={[1, 3, 2, 6, 9, 14, 12, 16, 13, 9, 5]} className="w-full h-16" />
            </CardBody>
          </Card>
          <div className="relative rounded-[var(--radius-lg)] overflow-hidden min-h-56 lg:col-span-2">
            <Image src={renderUrl("array")} alt="" fill sizes="100vw" className="object-cover" />
            <div className="absolute left-4 top-4 glass rounded-[var(--radius-md)] p-4 max-w-xs">
              <div className="text-sm font-medium">Glass surface</div>
              <p className="text-xs text-muted mt-1">For overlays on 3D scenes, maps and imagery. Blur 16px, 140% saturation.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="radius" title="Radius, elevation & motion">
        <div className="flex flex-wrap gap-4">
          {["xs", "sm", "md", "lg", "xl"].map((r) => (
            <div key={r} className="size-24 bg-surface border border-border grid place-items-center text-xs font-mono text-muted shadow-md" style={{ borderRadius: `var(--radius-${r})` }}>
              {r}
            </div>
          ))}
          <div className="size-24 rounded-[var(--radius-lg)] bg-swarm shadow-glow grid place-items-center text-xs font-mono text-white">glow</div>
        </div>
        <p className="text-sm text-muted mt-4">Motion: 140 / 260 / 520 ms with ease-out cubic-bezier(0.22, 1, 0.36, 1); all animation is disabled under prefers-reduced-motion.</p>
      </Section>

      <Section id="renders" title="3D & render assets" lead="Blender-scripted models (blender/solarbot_v2.py, props_v2.py) produce the Cycles renders and the Draco-compressed GLBs used live on the site and in the app.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["studio", "hero", "detail_sensor", "detail_wheel", "array", "formation", "onboarding", "gate", "swap", "satellite"].map((r) => (
            <figure key={r} className="rounded-[var(--radius-lg)] overflow-hidden border border-border bg-surface">
              <div className="relative aspect-[4/3]">
                <Image src={renderUrl(r)} alt={r} fill sizes="25vw" className="object-cover" />
              </div>
              <figcaption className="px-3 py-2 text-xs font-mono text-muted">/renders/{r}.jpg</figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-4 text-sm text-muted">
          GLB rig nodes: <code className="font-mono text-text">mast_height · panel_azimuth · panel_tilt · wheel_FL/FR/RL/RR</code>; LED materials{" "}
          <code className="font-mono text-text">LED_Front · LED_Rear · LED_Status</code>.
        </div>
      </Section>
    </div>
  );
}
