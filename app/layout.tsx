import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Where’s My Masjid",
  description: "Find nearby masjids, jamaat timings, and Qibla direction.",
  applicationName: "Where’s My Masjid"
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
        <div className="page-shell">
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
