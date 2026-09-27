"use client";

import dynamic from "next/dynamic";

export const FleetMapLazy = dynamic(() => import("./FleetMap").then((m) => m.FleetMap), {
  ssr: false,
  loading: () => <div className="size-full bg-surface-2 animate-pulse" />,
});
