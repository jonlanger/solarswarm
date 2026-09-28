"use client";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { InfraKind, LngLat } from "@/lib/sim/layout";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const ESRI_ATTR = "Imagery © Esri, Maxar, Earthstar Geographics";
const OFM_ATTR =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

const VIOLET = "#9d6bff";
const COPPER = "#e0a36a";

/** Sub-metre imagery: tracing a fence line needs far more detail than the fleet map's 10 m Sentinel-2 mosaic. */
function imageryStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      imagery: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: ESRI_ATTR,
      },
      // not drawn: only read to find the nearest road for the drop-off suggestion
      ofm: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: OFM_ATTR },
    },
    layers: [
      { id: "imagery", type: "raster", source: "imagery", paint: { "raster-saturation": -0.15 } },
      {
        id: "road-probe",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        paint: { "line-opacity": 0 },
      },
    ],
  };
}

export interface MapperSlot {
  p: LngLat;
  /** 0 = open, 1 = gets a unit, 2 = blocked by infrastructure */
  s: 0 | 1 | 2;
}
export interface MapperInfra {
  kind: InfraKind;
  label: string;
  center: LngLat;
  corners: LngLat[];
  truck?: LngLat[];
}

const ring = (pts: LngLat[]) => [...pts, pts[0]];
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

function vertexEl(first: boolean) {
  const d = document.createElement("div");
  d.style.cssText = `width:${first ? 16 : 12}px;height:${first ? 16 : 12}px;border-radius:999px;background:#fff;border:2.5px solid ${VIOLET};box-shadow:0 1px 4px rgb(0 0 0/.5);cursor:grab`;
  return d;
}

function infraEl(kind: InfraKind, label: string) {
  const d = document.createElement("div");
  const color = kind === "swap" ? COPPER : VIOLET;
  d.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 9px 4px 5px;border-radius:999px;background:rgb(20 10 40/.88);color:#fff;font:600 11px/1 var(--font-sans,system-ui);border:1.5px solid ${color};box-shadow:0 2px 8px rgb(0 0 0/.45);cursor:grab;white-space:nowrap`;
  const icon =
    kind === "swap"
      ? '<path d="M6 7h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M22 11v2"/><path d="m11 9-2 3h4l-2 3"/>'
      : '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>';
  d.innerHTML = `<span style="display:grid;place-items:center;width:20px;height:20px;border-radius:999px;background:${color}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>${label}`;
  return d;
}

export function SiteMapper({
  center,
  perimeter,
  closed,
  drawing,
  onPerimeter,
  slots = [],
  infra = [],
  onMoveInfra,
  routes = [],
  onRoad,
  className,
}: {
  center: LngLat;
  perimeter: LngLat[];
  closed: boolean;
  /** clicks on the map add fence posts */
  drawing: boolean;
  /** omit to lock the fence */
  onPerimeter?: (pts: LngLat[], closed: boolean) => void;
  slots?: MapperSlot[];
  infra?: MapperInfra[];
  /** omit to lock infrastructure; `done` is true on drag end */
  onMoveInfra?: (kind: InfraKind, p: LngLat, done: boolean) => void;
  routes?: LngLat[][];
  /** nearest mapped road to `center`, once tiles load */
  onRoad?: (p: LngLat | null) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState<LngLat | null>(null);
  const live = useRef({ perimeter, closed, drawing, onPerimeter, onMoveInfra, onRoad, center });
  live.current = { perimeter, closed, drawing, onPerimeter, onMoveInfra, onRoad, center };
  const vertexMarkers = useRef<maplibregl.Marker[]>([]);
  const infraMarkers = useRef(new Map<InfraKind, { m: maplibregl.Marker; dragging: boolean }>());

  // create the map once
  useEffect(() => {
    if (!el.current) return;
    const c = live.current;
    const m = new maplibregl.Map({
      container: el.current,
      style: imageryStyle(),
      center: c.center,
      zoom: 17.6,
      maxZoom: 20.5,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");
    m.on("load", () => {
      const empty = fc([]);
      for (const id of ["fence", "draft", "slots", "infra", "truck", "routes"]) m.addSource(id, { type: "geojson", data: empty });
      m.addLayer({ id: "fence-fill", type: "fill", source: "fence", paint: { "fill-color": VIOLET, "fill-opacity": 0.12 } });
      m.addLayer({ id: "fence-line", type: "line", source: "fence", paint: { "line-color": "#fff", "line-width": 2.5 } });
      m.addLayer({
        id: "draft-line",
        type: "line",
        source: "draft",
        paint: { "line-color": "#fff", "line-width": 2, "line-dasharray": [2, 1.5] },
      });
      m.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round" },
        paint: { "line-color": COPPER, "line-width": 2, "line-dasharray": [0.5, 2], "line-opacity": 0.9 },
      });
      m.addLayer({
        id: "slots",
        type: "circle",
        source: "slots",
        paint: {
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 15, 0.6, 18, 3.2, 20, 12],
          "circle-color": ["match", ["get", "s"], 1, VIOLET, 2, "#ff5a6a", "rgba(255,255,255,0.15)"],
          "circle-stroke-color": ["match", ["get", "s"], 1, "#fff", 2, "#ff5a6a", "rgba(255,255,255,0.75)"],
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 16, 0.4, 19, 1.2],
          "circle-opacity": ["match", ["get", "s"], 2, 0.35, 1],
        },
      });
      m.addLayer({
        id: "truck",
        type: "fill",
        source: "truck",
        paint: { "fill-color": "#fff", "fill-opacity": 0.28 },
      });
      m.addLayer({
        id: "truck-line",
        type: "line",
        source: "truck",
        paint: { "line-color": "#fff", "line-width": 1.5, "line-dasharray": [2, 1] },
      });
      m.addLayer({
        id: "infra-fill",
        type: "fill",
        source: "infra",
        paint: { "fill-color": ["match", ["get", "kind"], "swap", COPPER, VIOLET], "fill-opacity": 0.45 },
      });
      m.addLayer({
        id: "infra-line",
        type: "line",
        source: "infra",
        paint: { "line-color": ["match", ["get", "kind"], "swap", COPPER, VIOLET], "line-width": 2 },
      });
      setReady(true);
    });
    m.on("click", (e) => {
      const { drawing, closed, perimeter, onPerimeter } = live.current;
      if (!drawing || closed || !onPerimeter) return;
      onPerimeter([...perimeter, [e.lngLat.lng, e.lngLat.lat]], false);
    });
    m.on("mousemove", (e) => {
      if (live.current.drawing && !live.current.closed) setCursor([e.lngLat.lng, e.lngLat.lat]);
    });
    m.getCanvas().addEventListener("mouseleave", () => setCursor(null));

    // nearest road for the drop-off suggestion (tiles are vector, so this works at any zoom they cover)
    let reported = "";
    m.on("idle", () => {
      const { center, onRoad } = live.current;
      const key = center.join();
      if (!onRoad || reported === key) return;
      reported = key;
      const pc = m.project(center);
      let best: { p: LngLat; d: number } | null = null;
      for (const f of m.querySourceFeatures("ofm", { sourceLayer: "transportation" })) {
        const cls = f.properties?.class as string;
        if (["rail", "transit", "ferry", "aerialway", "path"].includes(cls)) continue;
        const g = f.geometry;
        const lines = g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : [];
        for (const line of lines)
          for (let i = 1; i < line.length; i++) {
            const a = m.project(line[i - 1] as LngLat);
            const b = m.project(line[i] as LngLat);
            const ab = b.sub(a);
            const ap = pc.sub(a);
            const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / (ab.mag() ** 2 || 1)));
            const q = a.add(ab.mult(t));
            const d = q.dist(pc);
            if (!best || d < best.d) {
              const ll = m.unproject(q);
              best = { p: [ll.lng, ll.lat], d };
            }
          }
      }
      // ignore roads more than ~2 screen-widths away
      onRoad(best && best.d < m.getCanvas().clientWidth * 2 ? best.p : null);
    });

    // the card resizes with the layout grid, not just the window
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);

    map.current = m;
    const infraHandles = infraMarkers.current;
    return () => {
      ro.disconnect();
      vertexMarkers.current.forEach((v) => v.remove());
      vertexMarkers.current = [];
      infraHandles.forEach((v) => v.m.remove());
      infraHandles.clear();
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    map.current?.flyTo({ center, zoom: Math.max(map.current.getZoom(), 17.6), duration: 1400, essential: true });
  }, [center]);

  // frame the fence once it's closed
  useEffect(() => {
    const m = map.current;
    if (!m || !closed || perimeter.length < 3) return;
    const b = new maplibregl.LngLatBounds();
    perimeter.forEach((p) => b.extend(p));
    m.fitBounds(b, { padding: 70, maxZoom: 19, duration: 900 });
    // only when the shape closes, not on every vertex drag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    m.getCanvas().style.cursor = drawing && !closed ? "crosshair" : "";
    if (drawing) m.doubleClickZoom.disable();
    else m.doubleClickZoom.enable();
  }, [drawing, closed, ready]);

  // fence + rubber band
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const poly = closed && perimeter.length >= 3;
    (m.getSource("fence") as GeoJSONSource).setData(
      fc(poly ? [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring(perimeter)] } }] : []),
    );
    const draft = !closed && perimeter.length ? [...perimeter, ...(cursor ? [cursor] : [])] : [];
    (m.getSource("draft") as GeoJSONSource).setData(
      fc(draft.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: draft } }] : []),
    );
  }, [perimeter, closed, cursor, ready]);

  // fence posts
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const editable = !!onPerimeter;
    const markers = vertexMarkers.current;
    if (markers.length !== perimeter.length || markers.some((mk) => mk.isDraggable() !== editable)) {
      markers.forEach((mk) => mk.remove());
      vertexMarkers.current = perimeter.map((p, i) => {
        const e = vertexEl(i === 0 && !closed);
        e.title = i === 0 && !closed ? "Click to close the perimeter" : "Drag to adjust";
        e.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const c = live.current;
          if (i === 0 && !c.closed && c.perimeter.length >= 3) c.onPerimeter?.(c.perimeter, true);
        });
        const mk = new maplibregl.Marker({ element: e, draggable: editable }).setLngLat(p).addTo(m);
        mk.on("drag", () => {
          const c = live.current;
          const ll = mk.getLngLat();
          c.onPerimeter?.(c.perimeter.map((q, j) => (j === i ? [ll.lng, ll.lat] : q)), c.closed);
        });
        return mk;
      });
    } else markers.forEach((mk, i) => mk.setLngLat(perimeter[i]));
    // closing changes the first post's affordance
    const first = vertexMarkers.current[0]?.getElement();
    if (first) {
      const size = closed ? "12px" : "16px";
      first.style.width = first.style.height = size;
      first.title = closed ? "Drag to adjust" : "Click to close the perimeter";
    }
  }, [perimeter, closed, onPerimeter]);

  // slots
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("slots") as GeoJSONSource).setData(
      fc(slots.map((s) => ({ type: "Feature", properties: { s: s.s }, geometry: { type: "Point", coordinates: s.p } }))),
    );
  }, [slots, ready]);

  // infrastructure footprints + routes
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("infra") as GeoJSONSource).setData(
      fc(infra.map((f) => ({ type: "Feature", properties: { kind: f.kind }, geometry: { type: "Polygon", coordinates: [ring(f.corners)] } }))),
    );
    (m.getSource("truck") as GeoJSONSource).setData(
      fc(
        infra
          .filter((f) => f.truck)
          .map((f) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring(f.truck!)] } })),
      ),
    );
    (m.getSource("routes") as GeoJSONSource).setData(
      fc(routes.map((r) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: r } }))),
    );
  }, [infra, routes, ready]);

  // infrastructure handles
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const have = infraMarkers.current;
    for (const [kind, v] of have)
      if (!infra.some((f) => f.kind === kind)) {
        v.m.remove();
        have.delete(kind);
      }
    for (const f of infra) {
      let v = have.get(f.kind);
      if (!v) {
        const mk = new maplibregl.Marker({ element: infraEl(f.kind, f.label), draggable: true }).setLngLat(f.center).addTo(m);
        const entry = { m: mk, dragging: false };
        mk.on("dragstart", () => (entry.dragging = true));
        mk.on("drag", () => {
          const ll = mk.getLngLat();
          live.current.onMoveInfra?.(f.kind, [ll.lng, ll.lat], false);
        });
        mk.on("dragend", () => {
          entry.dragging = false;
          const ll = mk.getLngLat();
          live.current.onMoveInfra?.(f.kind, [ll.lng, ll.lat], true);
        });
        have.set(f.kind, entry);
        v = entry;
      }
      v.m.setDraggable(!!onMoveInfra);
      v.m.getElement().style.cursor = onMoveInfra ? "grab" : "default";
      if (!v.dragging) v.m.setLngLat(f.center);
    }
  }, [infra, onMoveInfra]);

  return (
    <div className={className}>
      <div ref={el} className="size-full" />
    </div>
  );
}
