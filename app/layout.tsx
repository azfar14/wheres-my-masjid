import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { BottomNav } from "@/components/BottomNav";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { getSiteUrl, siteDescription, siteKeywords, siteName, siteTitle } from "@/lib/seoConfig";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: siteTitle,
    template: `%s | ${siteName}`
  },
  description: siteDescription,
  keywords: siteKeywords,
  applicationName: siteName,
  manifest: "/manifest.webmanifest",
  authors: [{ name: "Thameem Azfar Ansari", url: "https://github.com/azfar14" }],
  creator: "Thameem Azfar Ansari",
  publisher: "Wannaapps Technologies",
  category: "community app",
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    type: "website",
    title: siteTitle,
    description: siteDescription,
    siteName,
    locale: "en_US",
    url: "/",
    images: [
      {
        url: "/og-cover.png",
        width: 1916,
        height: 821,
        alt: "Where’s My Masjid app cover showing nearby masjid discovery, Qibla direction, trusted timings, and masjid claims"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og-cover.png"]
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f3d2e"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <GoogleAnalytics />
        <div className="page-shell">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
