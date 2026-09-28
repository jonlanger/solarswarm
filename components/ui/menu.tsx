"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/a11y/settings";
import { cn } from "@/lib/cn";
import { MobileSheet, Portal, floatingClass, itemClass, useAnchoredPosition, useDismiss, type Align } from "./popover";

export type MenuEntry =
  | {
      label: React.ReactNode;
      icon?: React.ReactNode;
      href?: string;
      onSelect?: () => void;
      danger?: boolean;
      /** trailing hint, e.g. a shortcut or current value */
      hint?: React.ReactNode;
    }
  | { separator: true }
  | { heading: React.ReactNode };

const isItem = (e: MenuEntry): e is Extract<MenuEntry, { label: React.ReactNode }> => "label" in e;

/**
 * Design-system action menu (WAI-ARIA menu button). Focus moves into the menu,
 * with arrow / Home / End / typeahead navigation and Escape to return to the trigger.
 * Opens as a bottom sheet on phones.
 */
export function Menu({
  label,
  items,
  children,
  align = "end",
  className,
  triggerClassName,
}: {
  /** accessible name of the trigger (and title of the mobile sheet) */
  label: string;
  items: MenuEntry[];
  /** trigger content; usually an icon */
  children: React.ReactNode;
  align?: Align;
  className?: string;
  triggerClassName?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const phone = useMediaQuery("(max-width: 639px)");
  const actionable = items.map((e, i) => (isItem(e) ? i : -1)).filter((i) => i >= 0);

  const style = useAnchoredPosition(open && !phone, triggerRef, menuRef, { align, matchWidth: false });
  const dismiss = useCallback(() => setOpen(false), []);
  useDismiss(open && !phone, [triggerRef, menuRef], dismiss);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const openAt = (which: "first" | "last") => {
    setActive(which === "first" ? 0 : actionable.length - 1);
    setOpen(true);
  };

  useEffect(() => {
    if (open) itemRefs.current[actionable[active]]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const n = actionable.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => (a + 1) % n);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => (a - 1 + n) % n);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(n - 1);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const q = e.key.toLowerCase();
          for (let k = 1; k <= n; k++) {
            const j = (active + k) % n;
            if (itemRefs.current[actionable[j]]?.textContent?.trim().toLowerCase().startsWith(q)) {
              setActive(j);
              break;
            }
          }
        }
    }
  };

  const body = (
    <div
      ref={menuRef}
      id={`${id}-menu`}
      role="menu"
      aria-labelledby={`${id}-trigger`}
      style={phone ? undefined : style}
      onKeyDown={onMenuKey}
      className={
        phone
          ? "overflow-y-auto overscroll-contain px-2 pb-2"
          : cn(floatingClass, "min-w-52 animate-[pop-in_var(--dur-fast)_var(--ease-out)]")
      }
    >
      {items.map((e, i) => {
        if ("separator" in e) return <div key={i} role="separator" className="my-1 h-px bg-border" />;
        if ("heading" in e)
          return (
            <div key={i} role="presentation" className="px-2.5 pt-2 pb-1 text-[0.6875rem] uppercase tracking-wider text-subtle">
              {e.heading}
            </div>
          );
        const idx = actionable.indexOf(i);
        const common = {
          ref: (el: HTMLElement | null) => {
            itemRefs.current[i] = el;
          },
          role: "menuitem",
          tabIndex: idx === active ? 0 : -1,
          onPointerMove: () => idx !== active && setActive(idx),
          className: cn(itemClass({ active: open && idx === active, danger: e.danger, large: phone }), "outline-none"),
        };
        const inner = (
          <Fragment>
            {e.icon && (
              <span className={cn("shrink-0 [&_svg]:size-4", e.danger ? "text-danger" : "text-muted")} aria-hidden>
                {e.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{e.label}</span>
            {e.hint && <span className="shrink-0 text-xs text-subtle">{e.hint}</span>}
          </Fragment>
        );
        return e.href ? (
          <Link key={i} href={e.href} {...common} onClick={() => setOpen(false)}>
            {inner}
          </Link>
        ) : (
          <button
            key={i}
            type="button"
            {...common}
            onClick={() => {
              e.onSelect?.();
              close();
            }}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close() : openAt("first"))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openAt(e.key === "ArrowDown" ? "first" : "last");
          }
        }}
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] text-text transition hover:bg-surface-2 aria-expanded:bg-surface-2 cursor-pointer",
          triggerClassName,
        )}
      >
        {children}
      </button>
      {phone ? (
        <MobileSheet open={open} title={label} onClose={close}>
          {body}
        </MobileSheet>
      ) : (
        <Portal>{open && body}</Portal>
      )}
    </div>
  );
}
