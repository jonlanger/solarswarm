/**
 * Versioned URLs for the Blender renders in public/renders. The files keep stable names, so bump RENDER_V whenever
 * they are re-rendered (blender/render_all.sh) — otherwise browsers and the Next image optimizer keep serving the
 * previous image for the same URL.
 */
export const RENDER_V = "2026-09-28c";

export const renderUrl = (name: string, ext: "jpg" | "png" = "jpg") => `/renders/${name}.${ext}?v=${RENDER_V}`;
