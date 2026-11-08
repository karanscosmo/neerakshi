import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Mono,
  Inter,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const notoKannada = Noto_Sans_Kannada({
  variable: "--font-noto-kannada",
  subsets: ["kannada"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Neerakshi — Every Drop, Seen from the Sky",
    template: "%s · Neerakshi",
  },
  description:
    "A satellite-driven agricultural water intelligence platform for India. Explore water stress, monsoon history, groundwater and field-level FAO-56 irrigation advisories.",
  applicationName: "Neerakshi",
  keywords: [
    "India water stress",
    "agricultural water",
    "satellite irrigation advisory",
    "FAO-56",
    "monsoon",
    "groundwater",
    "remote sensing",
  ],
  authors: [{ name: "Neerakshi Project" }],
  openGraph: {
    title: "Neerakshi — Every Drop, Seen from the Sky",
    description:
      "Satellite-driven agricultural water intelligence for India, from national stress geography to individual field irrigation advice.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#071521",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${plexMono.variable} ${notoKannada.variable} ${notoDevanagari.variable}`}
    >
      <body className="min-h-screen font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-glacier focus:px-4 focus:py-2 focus:text-midnight"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
