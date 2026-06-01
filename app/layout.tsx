import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { BottomNav } from "@/components/BottomNav";
import { AppFooter } from "@/components/AppFooter";



export const metadata: Metadata = {
  metadataBase: new URL("https://whereismymasjid.com"),
  other: {
    "google-adsense-account": "ca-pub-7913609166514231"
  },

  title: {
    default: "Where’s My Masjid | Nearby Masjids, Qibla & Jamaat Timings",
    template: "%s | Where’s My Masjid"
  },

  description:
    "Find nearby masjids, verified jamaat timings, Qibla direction, saved masjids, and trusted updates from masjid teams wherever you are.",

  keywords: [
    "Where’s My Masjid",
    "nearby masjid",
    "masjid finder",
    "mosque finder",
    "jamaat timings",
    "Qibla direction",
    "Muslim prayer app",
    "masjid near me",
    "verified masjid timings",
    "mosque locator",
    "masjid locator"
  ],

  applicationName: "Where’s My Masjid",

  manifest: "/manifest.webmanifest",

  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "48x48 32x32 16x16",
        type: "image/x-icon"
      },
      {
        url: "/favicon.svg",
        type: "image/svg+xml"
      },
      {
        url: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png"
      },
      {
        url: "/favicon.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    shortcut: "/favicon.ico",
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  },

  appleWebApp: {
    title: "Where’s My Masjid",
    capable: true,
    statusBarStyle: "default"
  },

  openGraph: {
    title: "Where’s My Masjid | Nearby Masjids, Qibla & Jamaat Timings",
    description:
      "Find nearby masjids, verified jamaat timings, Qibla direction, saved masjids, and trusted updates from masjid teams.",
    url: "https://whereismymasjid.com",
    siteName: "Where’s My Masjid",
    type: "website",
    images: [
      {
        url: "/og-cover.png",
        width: 1200,
        height: 630,
        alt: "Where’s My Masjid app preview"
      }
    ]
  },

  twitter: {
    card: "summary_large_image",
    title: "Where’s My Masjid | Nearby Masjids, Qibla & Jamaat Timings",
    description:
      "Find nearby masjids, verified jamaat timings, Qibla direction, saved masjids, and trusted updates from masjid teams.",
    images: ["/og-cover.png"]
  },

  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f3d2e"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <body>
        <PwaRegister />

        <div className="page-shell">
          {children}
          <AppFooter />
          <BottomNav />
        </div>
      </body>

      {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
    </html>
  );
}
