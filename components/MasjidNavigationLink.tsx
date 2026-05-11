import { getMasjidNavigationAction } from "@/lib/navigationTrust";
import type { Coordinates, Masjid } from "@/types";

export function MasjidNavigationLink({ masjid, userLocation }: { masjid: Masjid; userLocation?: Coordinates }) {
  const action = getMasjidNavigationAction(masjid, userLocation);

  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      title={action.helperText}
      data-trusted-route={action.trustedForDirectRoute ? "true" : "false"}
    >
      {action.label}
    </a>
  );
}
