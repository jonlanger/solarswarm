"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      aria-label={typeof title === "string" ? title : undefined}
      className={cn(
        "fixed z-40 top-0 right-0 h-dvh w-full sm:w-[420px] bg-surface border-l border-border shadow-lg flex flex-col transition-[transform,visibility] duration-300 ease-[var(--ease-out)]",
        open ? "translate-x-0" : "translate-x-full invisible",
        className,
      )}
    >
      <div className="flex items-center justify-between h-14 px-5 border-b border-border shrink-0">
        <div className="font-semibold text-[0.9375rem] truncate">{title}</div>
        <IconButton label="Close" size="sm" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
