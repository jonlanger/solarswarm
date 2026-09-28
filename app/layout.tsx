import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { A11Y_BOOT_SCRIPT, A11yEffects } from "@/lib/a11y/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// opt-in legible typeface (Settings → Accessibility); not preloaded since most visitors never switch
const hyperlegible = Atkinson_Hyperlegible({
  variable: "--font-hyperlegible",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0a10" },
  ],
};

export const metadata: Metadata = {
  title: "SolarSwarm: autonomous solar fields",
  description:
    "Robotic solar trackers that deliver, deploy and follow the sun on their own, plus the fleet software to run them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOT_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${hyperlegible.variable} antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:shadow-lg"
        >
          Skip to content
        </a>
        <A11yEffects />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
