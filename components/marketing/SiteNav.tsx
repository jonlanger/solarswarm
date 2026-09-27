"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo, ThemeToggle, buttonClass, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";

const links = [
  { href: "/#deploy", label: "How it deploys" },
  { href: "/#tracking", label: "Sun tracking" },
  { href: "/#platform", label: "Platform" },
  { href: "/#ops", label: "SolarSwarm Ops" },
  { href: "/design-system", label: "Design system" },
];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // white-on-transparent only while floating over the dark homepage hero
  const overHero = pathname === "/" && !scrolled && !open;
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        overHero ? "bg-transparent border-b border-transparent" : "glass border-x-0 border-t-0",
      )}
    >
      <nav className="mx-auto max-w-7xl h-16 px-4 sm:px-6 flex items-center gap-6">
        <Link href="/" aria-label="SolarSwarm home" className={cn(overHero && "text-white")}>
          <Logo />
        </Link>
        <div className="hidden lg:flex items-center gap-1 ml-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-3 h-9 inline-flex items-center rounded-[var(--radius-sm)] text-[13.5px] transition",
                overHero ? "text-white/80 hover:text-white hover:bg-white/10" : "text-muted hover:text-text hover:bg-surface-2",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className={cn(overHero && "text-white hover:bg-white/10")} />
          <Link href="/app" className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>
            Open the platform
          </Link>
          <IconButton
            label={open ? "Close menu" : "Open menu"}
            className={cn("lg:hidden", overHero && "text-white hover:bg-white/10")}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </IconButton>
        </div>
      </nav>
      {open && (
        <div className="lg:hidden px-4 pb-4 flex flex-col gap-1">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="h-11 flex items-center px-3 rounded-[var(--radius-sm)] hover:bg-surface-2">
              {l.label}
            </Link>
          ))}
          <Link href="/app" className={buttonClass("primary", "md", "mt-2")}>
            Open the platform
          </Link>
        </div>
      )}
    </header>
  );
}
