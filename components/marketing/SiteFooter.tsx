import Link from "next/link";
import { Logo } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="text-sm text-muted mt-4">
            Autonomous, sun-tracking solar that arrives on a truck and deploys itself. Plus the software to run
            every unit.
          </p>
        </div>
        {[
          { h: "Product", l: [["Robots", "/#robot"], ["Deployment", "/#deploy"], ["Sun tracking", "/#tracking"]] },
          { h: "Platform", l: [["Fleet map", "/app/map"], ["Energy", "/app/energy"], ["Maintenance", "/app/maintenance"]] },
          { h: "Company", l: [["Open the platform", "/app"]] },
        ].map((c) => (
          <div key={c.h}>
            <div className="text-xs font-medium uppercase tracking-wider text-subtle">{c.h}</div>
            <ul className="mt-3 space-y-2">
              {c.l.map(([t, h]) => (
                <li key={t}>
                  <Link href={h} className="text-sm text-muted hover:text-text">
                    {t}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 border-t border-border text-xs text-subtle flex flex-wrap gap-x-6 gap-y-2 justify-between">
        <span>© {new Date().getFullYear()} SolarSwarm. Concept prototype.</span>
        <span>
          Map data © OpenStreetMap contributors · OpenFreeMap · Imagery: Sentinel-2 cloudless by EOX IT Services
          GmbH (2016, CC BY 4.0) · Renders made in Blender
        </span>
      </div>
    </footer>
  );
}
