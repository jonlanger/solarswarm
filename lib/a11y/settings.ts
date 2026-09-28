"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Accessibility & display preferences.
 * Persisted to localStorage and mirrored onto <html data-*> attributes, which tokens.css / globals.css key off.
 * `A11Y_BOOT_SCRIPT` applies the same attributes before first paint so there is no flash.
 */

export type TextSize = "default" | "large" | "xlarge";
export type Motion = "system" | "reduce" | "full";
export type Contrast = "system" | "more" | "standard";
export type FontChoice = "geist" | "hyperlegible";
export type Palette = "default" | "cvd";

export interface A11ySettings {
  textSize: TextSize;
  motion: Motion;
  contrast: Contrast;
  font: FontChoice;
  palette: Palette;
  underlineLinks: boolean;
  boldFocus: boolean;
  pauseLive: boolean;
}

export const A11Y_DEFAULTS: A11ySettings = {
  textSize: "default",
  motion: "system",
  contrast: "system",
  font: "geist",
  palette: "default",
  underlineLinks: false,
  boldFocus: false,
  pauseLive: false,
};

export const A11Y_STORAGE_KEY = "solarswarm-a11y";

interface A11yState extends A11ySettings {
  set: <K extends keyof A11ySettings>(key: K, value: A11ySettings[K]) => void;
  reset: () => void;
}

export const useA11y = create<A11yState>()(
  persist(
    (set) => ({
      ...A11Y_DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<A11ySettings>),
      reset: () => set(A11Y_DEFAULTS),
    }),
    { name: A11Y_STORAGE_KEY, version: 1 },
  ),
);

/** html attribute for each setting (value "default"-ish settings remove the attribute). */
function attrs(s: A11ySettings): Record<string, string | null> {
  return {
    "data-text": s.textSize === "default" ? null : s.textSize,
    "data-motion": s.motion === "system" ? null : s.motion,
    "data-contrast": s.contrast === "system" ? null : s.contrast,
    "data-font": s.font === "geist" ? null : s.font,
    "data-palette": s.palette === "default" ? null : s.palette,
    "data-links": s.underlineLinks ? "underline" : null,
    "data-focus": s.boldFocus ? "bold" : null,
  };
}

/** Mount once near the root: keeps <html> attributes in sync with the store. */
export function A11yEffects() {
  const s = useA11y();
  useEffect(() => {
    const el = document.documentElement;
    for (const [k, v] of Object.entries(attrs(s))) {
      if (v == null) el.removeAttribute(k);
      else el.setAttribute(k, v);
    }
  }, [s]);
  return null;
}

/** Inline <head> script: applies persisted attributes before hydration. Keep in sync with `attrs`. */
export const A11Y_BOOT_SCRIPT = `(function(){try{var s=(JSON.parse(localStorage.getItem(${JSON.stringify(
  A11Y_STORAGE_KEY,
)})||"{}").state)||{};var e=document.documentElement;function a(k,v){if(v)e.setAttribute(k,v)}
a("data-text",s.textSize&&s.textSize!=="default"&&s.textSize);a("data-motion",s.motion&&s.motion!=="system"&&s.motion);
a("data-contrast",s.contrast&&s.contrast!=="system"&&s.contrast);a("data-font",s.font&&s.font!=="geist"&&s.font);
a("data-palette",s.palette&&s.palette!=="default"&&s.palette);a("data-links",s.underlineLinks&&"underline");
a("data-focus",s.boldFocus&&"bold")}catch(_){}})();`;

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatch(mq.matches);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** True when the user asked for reduced motion, in settings or at the OS level (unless overridden to "full"). */
export function useReducedMotion() {
  const motion = useA11y((s) => s.motion);
  const system = useMediaQuery("(prefers-reduced-motion: reduce)");
  return motion === "reduce" || (motion === "system" && system);
}
