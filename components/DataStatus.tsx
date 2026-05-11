import type { DataSource } from "@/types";

type DataStatusProps = {
  source: DataSource;
  message?: string;
  isLoading?: boolean;
};

export function DataStatus({ source, message, isLoading }: DataStatusProps) {
  if (isLoading) {
    return <div className="notice neutral">Loading nearby data…</div>;
  }

  if (source === "error") {
    return <div className="notice danger">Could not load verified masjid data. Nearby discovery can still work from provider layers.</div>;
  }

  if (source === "local_discovery") {
    return <div className="notice neutral">{message ?? "This listing came from your recent nearby search."}</div>;
  }

  // Do not show internal Firebase/demo setup banners to public users.
  return null;
}
