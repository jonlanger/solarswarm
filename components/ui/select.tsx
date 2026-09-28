"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useMediaQuery } from "@/lib/a11y/settings";
import { cn } from "@/lib/cn";
import { MobileSheet, Portal, floatingClass, itemClass, useAnchoredPosition, useDismiss, type Align } from "./popover";

export interface SelectOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  /** plain text used for typeahead when `label` is not a string */
  textValue?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[0.8125rem] gap-1.5",
  md: "h-9 px-3 text-sm gap-2",
  lg: "h-10 px-3 text-sm gap-2",
};

function textOf<T extends string | number>(o: SelectOption<T>) {
  return (o.textValue ?? (typeof o.label === "string" ? o.label : String(o.value))).toLowerCase();
}

/**
 * Design-system select. Implements the WAI-ARIA "select-only combobox" pattern:
 * focus stays on the trigger, the active option is exposed through aria-activedescendant,
 * with arrow / Home / End / typeahead / Enter / Escape. On phones the options open in a bottom sheet
 * with 48px rows instead of an anchored popover.
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  label,
  hideLabel,
  placeholder = "Select…",
  size = "md",
  icon,
  align = "start",
  disabled,
  renderValue,
  className,
  triggerClassName,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  /** accessible name; shown above the trigger unless `hideLabel` */
  label: string;
  hideLabel?: boolean;
  placeholder?: string;
  size?: Size;
  /** leading icon inside the trigger */
  icon?: React.ReactNode;
  align?: Align;
  disabled?: boolean;
  /** custom rendering of the selected value in the trigger */
  renderValue?: (o: SelectOption<T>) => React.ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const triggerId = `${id}-trigger`;
  const listId = `${id}-list`;
  const optId = (i: number) => `${id}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const phone = useMediaQuery("(max-width: 639px)");
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const style = useAnchoredPosition(open && !phone, triggerRef, listRef, { align });
  const dismiss = useCallback(() => setOpen(false), []);
  useDismiss(open && !phone, [triggerRef, listRef], dismiss);

  const enabled = (i: number) => !!options[i] && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (enabled(i)) return i;
    }
    return from;
  };
  const first = () => step(-1, 1);
  const last = () => step(options.length, -1);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const openAt = (i: number) => {
    setActive(enabled(i) ? i : first());
    setOpen(true);
    // Safari doesn't focus buttons on click; keyboard handling lives on the trigger
    triggerRef.current?.focus();
  };
  const commit = (i: number) => {
    if (!enabled(i)) return;
    onChange(options[i].value);
    close();
  };

  const typed = useRef({ buf: "", at: 0 });
  const typeahead = (ch: string, from: number) => {
    const now = Date.now();
    const buf = now - typed.current.at > 700 ? ch : typed.current.buf + ch;
    typed.current = { buf, at: now };
    const q = buf.toLowerCase();
    // a fresh single keystroke cycles forward from the current option; a longer query refines in place
    const offset = buf.length === 1 ? 1 : 0;
    for (let n = 0; n < options.length; n++) {
      const i = (Math.max(from, 0) + offset + n) % options.length;
      if (enabled(i) && textOf(options[i]).startsWith(q)) return i;
    }
    return -1;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    const printable = k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;
    if (!open) {
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") {
        e.preventDefault();
        openAt(selectedIndex >= 0 ? selectedIndex : k === "ArrowUp" ? last() : first());
      } else if (printable) {
        const i = typeahead(k, selectedIndex);
        if (i >= 0) onChange(options[i].value);
      }
      return;
    }
    switch (k) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => step(a, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => step(a, -1));
        break;
      case "Home":
      case "PageUp":
        e.preventDefault();
        setActive(first());
        break;
      case "End":
      case "PageDown":
        e.preventDefault();
        setActive(last());
        break;
      case "Enter":
        e.preventDefault();
        commit(active);
        break;
      case " ":
        e.preventDefault();
        if (Date.now() - typed.current.at < 700) typeahead(" ", active);
        else commit(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (printable) {
          const i = typeahead(k, active);
          if (i >= 0) setActive(i);
        }
    }
  };

  // keep the active option visible; in sheet mode move focus into the list
  useEffect(() => {
    if (!open) return;
    if (phone) listRef.current?.focus();
    document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, phone]);

  const list = (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-labelledby={labelId}
      aria-activedescendant={phone && active >= 0 ? optId(active) : undefined}
      tabIndex={-1}
      style={phone ? undefined : style}
      onKeyDown={phone ? onKeyDown : undefined}
      // keep focus on the trigger while clicking options
      onMouseDown={phone ? undefined : (e) => e.preventDefault()}
      className={
        phone
          ? "flex-1 overflow-y-auto overscroll-contain px-2 pb-2 outline-none"
          : cn(floatingClass, "animate-[pop-in_var(--dur-fast)_var(--ease-out)]")
      }
    >
      {options.map((o, i) => {
        const isSelected = o.value === value;
        return (
          <li
            key={String(o.value)}
            id={optId(i)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={o.disabled || undefined}
            onPointerMove={() => enabled(i) && active !== i && setActive(i)}
            onClick={() => commit(i)}
            className={cn(
              itemClass({ active: i === active, large: phone }),
              isSelected && "font-medium",
              o.disabled && "opacity-45 cursor-not-allowed",
            )}
          >
            {o.icon && (
              <span className="shrink-0 text-muted [&_svg]:size-4" aria-hidden>
                {o.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 py-1.5">
              <span className="block truncate">{o.label}</span>
              {o.description && <span className="block text-xs font-normal text-muted truncate">{o.description}</span>}
            </span>
            <Check className={cn("size-4 shrink-0 text-primary", !isSelected && "invisible")} />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={cn("min-w-0", className)}>
      <span
        id={labelId}
        className={hideLabel ? "sr-only" : "mb-1.5 block text-sm text-muted"}
        onClick={() => triggerRef.current?.focus()}
      >
        {label}
      </span>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${triggerId}`}
        aria-activedescendant={open && !phone && active >= 0 ? optId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openAt(selectedIndex))}
        onKeyDown={onKeyDown}
        className={cn(
          "group flex w-full items-center rounded-[var(--radius-sm)] border border-border bg-surface text-left text-text transition cursor-pointer",
          "hover:border-border-strong aria-expanded:border-primary aria-expanded:shadow-[var(--ring)] disabled:opacity-50 disabled:pointer-events-none",
          sizes[size],
          triggerClassName,
        )}
      >
        {icon && (
          <span className="shrink-0 text-muted [&_svg]:size-4" aria-hidden>
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">
          {selected ? (renderValue ? renderValue(selected) : selected.label) : <span className="text-subtle">{placeholder}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-150 group-aria-expanded:rotate-180" />
      </button>
      {phone ? (
        <MobileSheet open={open} title={label} onClose={close}>
          {list}
        </MobileSheet>
      ) : (
        <Portal>{open && list}</Portal>
      )}
    </div>
  );
}
