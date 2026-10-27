import localFont from "next/font/local";

// Fonts are self-hosted from @fontsource files (copied into app/fonts) and
// served through next/font so they are preloaded, subset per script and
// never fetched from a third-party CDN at runtime.

export const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/fraunces-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/fraunces-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/fraunces-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/fraunces-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
});

export const sans = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
  ],
});

export const mono = localFont({
  variable: "--font-mono",
  display: "swap",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
  ],
});

// Indian scripts: not preloaded (only needed when hi/kn is active), loaded on demand by unicode-range.
export const devaBody = localFont({
  variable: "--font-deva",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/noto-sans-devanagari-devanagari-400-normal.woff2", weight: "400" },
    { path: "./fonts/noto-sans-devanagari-devanagari-600-normal.woff2", weight: "600" },
  ],
});

export const knBody = localFont({
  variable: "--font-kn",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/noto-sans-kannada-kannada-400-normal.woff2", weight: "400" },
    { path: "./fonts/noto-sans-kannada-kannada-600-normal.woff2", weight: "600" },
  ],
});

export const devaDisplay = localFont({
  variable: "--font-deva-display",
  display: "swap",
  preload: false,
  src: [{ path: "./fonts/tiro-devanagari-hindi-devanagari-400-normal.woff2", weight: "400" }],
});

export const knDisplay = localFont({
  variable: "--font-kn-display",
  display: "swap",
  preload: false,
  src: [{ path: "./fonts/tiro-kannada-kannada-400-normal.woff2", weight: "400" }],
});

export const fontVars = [display, sans, mono, devaBody, knBody, devaDisplay, knDisplay].map((f) => f.variable).join(" ");
