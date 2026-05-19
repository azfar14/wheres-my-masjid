"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const pathname = usePathname();

  useEffect(() => {
    if (!measurementId || typeof window === "undefined") return;

    const timeout = window.setTimeout(() => {
      if (!window.gtag) return;
      window.gtag("event", "page_view", {
        page_title: document.title,
        page_path: window.location.pathname,
        page_location: window.location.href
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [measurementId, pathname]);

  if (!measurementId) return null;

  const measurementIdJson = JSON.stringify(measurementId);

  return (
    <>
      <Script
        id="google-analytics-src"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', ${measurementIdJson}, { send_page_view: false });
          `
        }}
      />
    </>
  );
}
