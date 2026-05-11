"use client";

import { useEffect, useState } from "react";
import { getStoredDiscoveredMasjid } from "@/lib/discoveredMasjidStorage";
import { getMasjid, listMasjids } from "@/lib/masjidService";
import { masjids as demoMasjids } from "@/lib/masjids";
import type { DataSource, Masjid } from "@/types";

type UseMasjidsOptions = {
  includeLegacyDemoRecords?: boolean;
};

function removeLegacyDemoRecordsWhenRealDataExists(masjids: Masjid[]): Masjid[] {
  const hasRealFirestoreRecords = masjids.some((masjid) => !masjid.id.startsWith("demo-"));
  return hasRealFirestoreRecords ? masjids.filter((masjid) => !masjid.id.startsWith("demo-")) : masjids;
}

export function useMasjids(options: UseMasjidsOptions = {}) {
  const [masjids, setMasjids] = useState<Masjid[]>(demoMasjids);
  const [source, setSource] = useState<DataSource>("demo");
  const [message, setMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    setIsLoading(true);
    const result = await listMasjids();
    setMasjids(options.includeLegacyDemoRecords ? result.masjids : removeLegacyDemoRecordsWhenRealDataExists(result.masjids));
    setSource(result.source);
    setMessage(result.message);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [options.includeLegacyDemoRecords]);

  return { masjids, source, message, isLoading, refresh };
}

export function useMasjid(id?: string) {
  const [masjid, setMasjid] = useState<Masjid | undefined>();
  const [source, setSource] = useState<DataSource>("demo");
  const [message, setMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(Boolean(id));

  async function refresh(nextId = id) {
    if (!nextId) return;
    setIsLoading(true);

    const result = await getMasjid(nextId);
    if (result.masjid) {
      setMasjid(result.masjid);
      setSource(result.source);
      setMessage(result.message);
      setIsLoading(false);
      return;
    }

    if (nextId.startsWith("osm-") || nextId.startsWith("google-") || nextId.startsWith("mappls-") || nextId.startsWith("foursquare-")) {
      const discovered = getStoredDiscoveredMasjid(nextId);
      if (discovered) {
        setMasjid(discovered);
        setSource("local_discovery");
        setMessage("This listing came from your latest precision nearby search. Verify timings before public use.");
        setIsLoading(false);
        return;
      }
    }

    setMasjid(undefined);
    setSource(result.source);
    setMessage(result.message);
    setIsLoading(false);
  }

  useEffect(() => {
    refresh(id);
  }, [id]);

  return { masjid, source, message, isLoading, refresh };
}
