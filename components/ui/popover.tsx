"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/**
 * Shared plumbing for Select and Menu: a floating layer anchored to a trigger.
 * Rendered in a portal with fixed positioning so it escapes overflow-hidden cards and the sticky header,
 * flips above the trigger when there is no room below, and stays inside the viewport.
 */

export type Align = "start" | "end";

// measured but not yet placed: transparent rather than visibility:hidden so focus can move in immediately
const HIDDEN: React.CSSProperties = { position: "fixed", top: 0, left: 0, opacity: 0, pointerEvents: "none" };

export function useAnchoredPosition(
  open: boolean,
  anchor: React.RefObject<HTMLElement | null>,
  floating: React.RefObject<HTMLElement | null>,
  { align = "start", offset = 6, matchWidth = true }: { align?: Align; offset?: number; matchWidth?: boolean } = {},
) {
  const [style, setStyle] = useState<React.CSSProperties>(HIDDEN);

  const update = useCallback(() => {
    const a = anchor.current?.getBoundingClientRect();
    const f = floating.current;
    if (!a || !f) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gutter = 8;
    const below = vh - a.bottom - offset - gutter;
    const above = a.top - offset - gutter;
    const natural = f.scrollHeight;
    const flip = natural > below && above > below;
    const maxHeight = Math.max(120, Math.min(360, flip ? above : below));
    const minWidth = matchWidth ? a.width : undefined;
    const width = Math.min(Math.max(f.offsetWidth, minWidth ?? 0), vw - gutter * 2);
    let left = align === "end" ? a.right - width : a.left;
    left = Math.min(Math.max(gutter, left), vw - width - gutter);
    setStyle({
      position: "fixed",
      left,
      minWidth,
      maxWidth: vw - gutter * 2,
      maxHeight,
      ...(flip ? { bottom: vh - a.top + offset } : { top: a.bottom + offset }),
    });
  }, [anchor, floating, align, offset, matchWidth]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(HIDDEN);
      return;
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return style;
}

/** Close on pointer-down outside any of the given elements. */
export function useDismiss(open: boolean, refs: React.RefObject<HTMLElement | null>[], onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, refs, onDismiss]);
}

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

/** Surface styling shared by every floating layer. */
export const floatingClass =
  "z-[60] overflow-y-auto overscroll-contain rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-lg outline-none";

/** Row styling shared by listbox options and menu items. */
export function itemClass({ active, danger, large }: { active?: boolean; danger?: boolean; large?: boolean }) {
  return cn(
    "flex w-full items-center gap-2.5 rounded-[var(--radius-xs)] px-2.5 text-left text-sm cursor-pointer select-none",
    large ? "min-h-12" : "min-h-9",
    danger ? "text-danger" : "text-text",
    active && (danger ? "bg-danger-soft" : "bg-surface-2"),
  );
}

/** Bottom sheet used on phones in place of an anchored popover. */
export function MobileSheet({
  open,
  title,
  onClose,
  children,
  className,
}: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  // the portal stays mounted so the sheet's content exists in the same commit that opens it
  return (
    <Portal>
      {open && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-[var(--overlay)] animate-[fade-in_var(--dur-fast)_ease-out]"
            onClick={onClose}
          />
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-[61] max-h-[75dvh] flex flex-col rounded-t-[var(--radius-xl)] border-t border-border bg-surface shadow-lg pb-[max(0.5rem,env(safe-area-inset-bottom))] animate-[sheet-up_var(--dur-med)_var(--ease-out)]",
              className,
            )}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" aria-hidden />
            <div className="px-5 pt-3 pb-2 text-sm font-semibold">{title}</div>
            {children}
          </div>
        </>
      )}
    </Portal>
  );
}
