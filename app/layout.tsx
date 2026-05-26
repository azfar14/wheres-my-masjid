import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { BottomNav } from "@/components/BottomNav";
import { AppFooter } from "@/components/AppFooter";



export const metadata: Metadata = {
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
    "find mosque near me",
    "masjid near me",
    "verified masjid timings"
  ],
  applicationName: "Where’s My Masjid",
  icons: {
    icon: [
      { url: "https://whereismymasjid.com//favicon.ico" },
      { url: "https://whereismymasjid.com//icon.png", type: "image/png", sizes: "512x512" }
    ],
    apple: [{ url: "https://whereismymasjid.com//apple-icon.png", sizes: "180x180", type: "image/png" }]
  },
  openGraph: {
    title: "Where’s My Masjid | Nearby Masjids, Qibla & Jamaat Timings",
    description:
      "Find nearby masjids, verified jamaat timings, Qibla direction, saved masjids, and trusted updates from masjid teams.",
    siteName: "Where’s My Masjid",
    type: "website",
    images: [
      {
        url: "https://whereismymasjid.com//og-cover.png",
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
    images: ["https://whereismymasjid.com//og-cover.png"]
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
