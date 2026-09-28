"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import type { RobotLive } from "@/lib/sim/store";
import { siteBoundary, type Site } from "@/lib/sim/model";
import { renderUrl } from "@/lib/renders";

export type Basemap = "satellite" | "map";

const EOX_ATTR =
  '<a href="https://s2maps.eu" target="_blank" rel="noreferrer">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)';
const OFM_ATTR =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/** Metres covered by each Blender ortho overlay (blender/render_scenes.py ORTHO_M). */
const ORTHO_M = 110;

function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      eox: {
        type: "raster",
        tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"],
        tileSize: 256,
        maxzoom: 15,
        attribution: EOX_ATTR,
      },
      ofm: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: OFM_ATTR },
    },
    layers: [
      { id: "eox", type: "raster", source: "eox", paint: { "raster-saturation": -0.1, "raster-contrast": 0.05 } },
      {
        id: "roads",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]],
        paint: {
          "line-color": "#ffffff",
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.25, 14, 0.45],
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 14, 2],
        },
      },
      {
        id: "places",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
        layout: {
          "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 12, 14],
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "rgba(10,6,20,0.8)", "text-halo-width": 1.4 },
      },
    ],
  };
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#9d6bff";
}

function lonLatOffset(lat: number, lon: number, dx: number, dy: number): [number, number] {
  return [lon + dx / (111_320 * Math.cos((lat * Math.PI) / 180)), lat + dy / 111_320];
}

function robotsGeoJSON(robots: RobotLive[]) {
  return {
    type: "FeatureCollection" as const,
    features: robots.map((r) => ({
      type: "Feature" as const,
      id: r.unit.id,
      properties: { id: r.unit.id, status: r.status, power: r.powerW, soc: r.soc, risk: r.unit.risk },
      geometry: { type: "Point" as const, coordinates: [r.unit.lon, r.unit.lat] },
    })),
  };
}

function sitesGeoJSON(sites: Site[], summary: Record<string, { kw: number; units: number }>) {
  return {
    points: {
      type: "FeatureCollection" as const,
      features: sites.map((s) => ({
        type: "Feature" as const,
        properties: {
          id: s.id,
          name: s.name,
          label: summary[s.id] ? `${s.name}\n${summary[s.id].kw.toFixed(0)} kW · ${summary[s.id].units} units` : s.name,
        },
        geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      })),
    },
    bounds: {
      type: "FeatureCollection" as const,
      features: sites.map((s) => ({
        type: "Feature" as const,
        properties: { id: s.id },
        geometry: { type: "Polygon" as const, coordinates: [siteBoundary(s)] },
      })),
    },
  };
}

export function FleetMap({
  sites,
  robots,
  summary,
  basemap = "satellite",
  heat = false,
  focusSiteId,
  selectedRobotId,
  onSelectRobot,
  onSelectSite,
  onPick,
  picked,
  className,
}: {
  sites: Site[];
  robots: RobotLive[];
  summary: Record<string, { kw: number; units: number }>;
  basemap?: Basemap;
  heat?: boolean;
  focusSiteId?: string;
  selectedRobotId?: string;
  onSelectRobot?: (id: string) => void;
  onSelectSite?: (id: string) => void;
  /** enables click-to-pick a location (onboarding) */
  onPick?: (lngLat: [number, number]) => void;
  picked?: [number, number];
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [styleTick, setStyleTick] = useState(0);
  const { resolvedTheme } = useTheme();
  const cb = useRef({ onSelectRobot, onSelectSite, onPick });
  cb.current = { onSelectRobot, onSelectSite, onPick };
  const marker = useRef<maplibregl.Marker | null>(null);

  // create map once
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: satelliteStyle(),
      center: [-104, 35],
      zoom: 3.6,
      maxZoom: 20.5,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");
    m.on("style.load", () => setStyleTick((t) => t + 1));
    m.on("click", "site-dots", (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) cb.current.onSelectSite?.(id);
    });
    m.on("click", (e) => {
      // generous hit box: robot markers are only a few pixels wide
      const r = 10;
      const box: [[number, number], [number, number]] = [
        [e.point.x - r, e.point.y - r],
        [e.point.x + r, e.point.y + r],
      ];
      const robots = m.getLayer("robots") ? m.queryRenderedFeatures(box, { layers: ["robots"] }) : [];
      if (robots.length) {
        const nearest = robots
          .map((f) => {
            const p = m.project((f.geometry as GeoJSON.Point).coordinates as [number, number]);
            return { id: f.properties?.id as string, d: Math.hypot(p.x - e.point.x, p.y - e.point.y) };
          })
          .sort((a, b) => a.d - b.d)[0];
        cb.current.onSelectRobot?.(nearest.id);
        return;
      }
      if (!cb.current.onPick) return;
      const hit = m.queryRenderedFeatures(e.point).some((f) => f.layer.id === "site-dots");
      if (!hit) cb.current.onPick([e.lngLat.lng, e.lngLat.lat]);
    });
    for (const l of ["robots", "site-dots"]) {
      m.on("mouseenter", l, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", l, () => (m.getCanvas().style.cursor = ""));
    }
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // swap basemap (the map is created with the satellite style)
  const styleKey = basemap === "satellite" ? "satellite" : `map-${resolvedTheme}`;
  const lastStyle = useRef("satellite");
  useEffect(() => {
    const m = map.current;
    if (!m || lastStyle.current === styleKey) return;
    lastStyle.current = styleKey;
    if (basemap === "satellite") m.setStyle(satelliteStyle());
    else m.setStyle(`https://tiles.openfreemap.org/styles/${resolvedTheme === "dark" ? "dark" : "positron"}`);
  }, [styleKey, basemap, resolvedTheme]);

  // (re)install our overlay layers whenever a style finishes loading
  useEffect(() => {
    const m = map.current;
    if (!m || !styleTick || m.getSource("sites")) return;
    const violet = "#9d6bff";
    const copper = "#e0a36a";
    const g = sitesGeoJSON(sites, summary);

    for (const s of sites.filter((x) => x.ortho)) {
      const half = ORTHO_M / 2;
      const tl = lonLatOffset(s.lat, s.lon, -half, half);
      const tr = lonLatOffset(s.lat, s.lon, half, half);
      const br = lonLatOffset(s.lat, s.lon, half, -half);
      const bl = lonLatOffset(s.lat, s.lon, -half, -half);
      m.addSource(`ortho-${s.id}`, {
        type: "image",
        url: renderUrl(`ortho_${s.id}`, "png"),
        coordinates: [tl, tr, br, bl],
      });
      m.addLayer({
        id: `ortho-${s.id}`,
        type: "raster",
        source: `ortho-${s.id}`,
        minzoom: 14,
        paint: { "raster-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.5, 1], "raster-fade-duration": 0 },
      });
    }
    m.addSource("bounds", { type: "geojson", data: g.bounds });
    m.addLayer({
      id: "bounds-fill",
      type: "fill",
      source: "bounds",
      minzoom: 12,
      paint: { "fill-color": violet, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.25, 16, 0.04] },
    });
    m.addLayer({
      id: "bounds-line",
      type: "line",
      source: "bounds",
      minzoom: 12,
      paint: { "line-color": violet, "line-width": 2, "line-dasharray": [2, 1.5] },
    });

    m.addSource("robots", { type: "geojson", data: robotsGeoJSON(robots) });
    m.addLayer({
      id: "robot-heat",
      type: "heatmap",
      source: "robots",
      minzoom: 13,
      maxzoom: 19,
      layout: { visibility: heat ? "visible" : "none" },
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "power"], 0, 0, 420, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 13, 0.6, 18, 1.4],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 13, 4, 18, 30],
        "heatmap-opacity": 0.75,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(42,14,97,0)",
          0.3,
          "#5b2bd9",
          0.6,
          "#9d6bff",
          0.85,
          "#e0a36a",
          1,
          "#fbefe3",
        ],
      },
    });
    const statusColor = [
      "match",
      ["get", "status"],
      "tracking",
      cssVar("--status-tracking"),
      "charging",
      cssVar("--status-charging"),
      "moving",
      cssVar("--status-moving"),
      "docked",
      cssVar("--status-docked"),
      "fault",
      cssVar("--status-fault"),
      "#999",
    ] as unknown as maplibregl.ExpressionSpecification;
    m.addLayer({
      id: "robots",
      type: "circle",
      source: "robots",
      minzoom: 15.5,
      paint: {
        "circle-color": statusColor,
        "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 16, 1.5, 18, 3, 20, 7],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 16, 0.4, 19, 1.2],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 15.5, 0, 16.2, 0.9],
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 15.5, 0, 16.2, 1],
      },
    });
    m.addLayer({
      id: "robot-selected",
      type: "circle",
      source: "robots",
      minzoom: 15.5,
      filter: ["==", ["get", "id"], selectedRobotId ?? ""],
      paint: {
        "circle-color": "rgba(0,0,0,0)",
        "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 16, 5, 18, 9, 20, 18],
        "circle-stroke-color": copper,
        "circle-stroke-width": 3,
      },
    });

    m.addSource("sites", { type: "geojson", data: g.points });
    m.addLayer({
      id: "site-halo",
      type: "circle",
      source: "sites",
      maxzoom: 14,
      paint: { "circle-color": violet, "circle-opacity": 0.25, "circle-radius": 18, "circle-blur": 0.6 },
    });
    m.addLayer({
      id: "site-dots",
      type: "circle",
      source: "sites",
      maxzoom: 14,
      paint: { "circle-color": violet, "circle-radius": 7, "circle-stroke-color": copper, "circle-stroke-width": 2.5 },
    });
    m.addLayer({
      id: "site-labels",
      type: "symbol",
      source: "sites",
      maxzoom: 14,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.4],
        "text-anchor": "top",
      },
      paint: { "text-color": "#ffffff", "text-halo-color": "rgba(20,6,47,0.9)", "text-halo-width": 1.6 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleTick]);

  // live data
  useEffect(() => {
    const src = map.current?.getSource("robots") as GeoJSONSource | undefined;
    src?.setData(robotsGeoJSON(robots));
  }, [robots, styleTick]);
  useEffect(() => {
    const g = sitesGeoJSON(sites, summary);
    (map.current?.getSource("sites") as GeoJSONSource | undefined)?.setData(g.points);
    (map.current?.getSource("bounds") as GeoJSONSource | undefined)?.setData(g.bounds);
  }, [sites, summary, styleTick]);
  // picked-location marker
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!picked) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) marker.current = new maplibregl.Marker({ color: "#b87333" });
    marker.current.setLngLat(picked).addTo(m);
  }, [picked]);
  useEffect(() => {
    const m = map.current;
    if (m?.getLayer("robot-heat")) m.setLayoutProperty("robot-heat", "visibility", heat ? "visible" : "none");
  }, [heat, styleTick]);
  useEffect(() => {
    const m = map.current;
    if (m?.getLayer("robot-selected")) m.setFilter("robot-selected", ["==", ["get", "id"], selectedRobotId ?? ""]);
  }, [selectedRobotId, styleTick]);

  // camera
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const site = sites.find((s) => s.id === focusSiteId);
    if (site) {
      m.flyTo({ center: [site.lon, site.lat], zoom: 18.2, pitch: 30, bearing: -8, duration: 2600, essential: true });
    } else if (sites.length) {
      const b = new maplibregl.LngLatBounds();
      sites.forEach((s) => b.extend([s.lon, s.lat]));
      m.fitBounds(b, { padding: 120, maxZoom: 13, pitch: 0, bearing: 0, duration: 1800 });
    }
  }, [focusSiteId, sites]);

  // maplibre forces `position: relative` on its container, so size it via a wrapper
  return (
    <div className={className}>
      <div ref={el} className="size-full" />
    </div>
  );
}
