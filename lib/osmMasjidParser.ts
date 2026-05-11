import type { Coordinates, DiscoveryQuality, Masjid, OsmConfidence, OsmReference } from "@/types";

export const MOSQUE_NAME_REGEX = "masjid|masjidh|masjith|masjithu|masjithunnabavi|mosque|mosquee|meczet|mezquita|mesquita|mechet|masjed|masjidun|masjidul|masjid al|masjid e|masjid-e|musalla|musallah|mussalla|mussolah|musholla|mushola|surau|langgar|pallivasal|pallivaasal|palli|jumma|juma|jamia|jama|jami|jame|jummah|eidgah|idgah|namaz|salah|islamic centre|islamic center|islamic society|islamic foundation|islamic|islam|muslim|bismillah|noorani|noor|madina|makkah|makka|makkah|aqsa|bilal|quba|مسجد|جامع|مصلى|مصلّى|مركز إسلامي|مركز اسلامي|مُصَلّى|मस्जिद|मसजिद|जामा|नमाज़|نماز|مسجिद|جامعہ|مسجدِ| பள்ளிவாசல்|பள்ளிவாசல்|மசூதி|ஜும்மா|தொழுகை|മസ്ജിദ്|പള്ളി|പള്ളിവാസൽ|ಜುಮ್ಮಾ|ಮಸೀದಿ|ಮಸ್ಜಿದ್|మసీదు|జామా|মসজিদ|জামে|মসজিদুল";

export const FALLBACK_JAMAAT = {
  fajr: "05:10",
  dhuhr: "13:30",
  asr: "17:15",
  maghrib: "18:45",
  isha: "20:15"
};

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

export type NominatimSearchItem = {
  place_id?: number | string;
  osm_type?: "node" | "way" | "relation" | "N" | "W" | "R";
  osm_id?: number | string;
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  class?: string;
  type?: string;
  importance?: number;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
  address?: Record<string, string>;
};

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function tagValue(tags: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = text(tags[key]);
    if (value) return normaliseWhitespace(value);
  }
  return undefined;
}

function matchesAny(value: string | undefined, regex: RegExp): boolean {
  return Boolean(value && regex.test(value));
}

export function nameLooksIslamic(name: string): boolean {
  return new RegExp(MOSQUE_NAME_REGEX, "i").test(name);
}

export function getBestOsmName(tags: Record<string, string>): string | undefined {
  const preferred = tagValue(tags, [
    "name",
    "name:en",
    "name:ta",
    "name:hi",
    "name:ur",
    "name:ar",
    "name:ml",
    "name:te",
    "name:kn",
    "name:bn",
    "name:fr",
    "official_name",
    "alt_name",
    "old_name",
    "short_name"
  ]);
  if (preferred) return preferred;

  const anyLocalizedName = Object.entries(tags)
    .filter(([key, value]) => /^name:[a-z_@-]+$/i.test(key) && text(value))
    .map(([, value]) => normaliseWhitespace(value))[0];
  if (anyLocalizedName) return anyLocalizedName;

  return tagValue(tags, ["operator", "contact:organisation", "brand"]);
}

export function buildOsmAddress(tags: Record<string, string>, coordinates: Coordinates): string {
  const fullAddress = tagValue(tags, ["addr:full", "contact:address", "address"]);
  if (fullAddress) return fullAddress;

  const addressParts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:place"],
    tags["addr:neighbourhood"] || tags["addr:suburb"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:district"],
    tags["addr:state"],
    tags["addr:postcode"]
  ]
    .map(text)
    .filter((value): value is string => Boolean(value));

  if (addressParts.length) return Array.from(new Set(addressParts)).join(", ");

  const locality = tagValue(tags, [
    "addr:place",
    "addr:neighbourhood",
    "addr:suburb",
    "addr:quarter",
    "addr:city",
    "addr:town",
    "addr:village",
    "is_in:neighbourhood",
    "is_in:suburb",
    "is_in:city",
    "is_in"
  ]);
  if (locality) return locality;

  return `OpenStreetMap pin at ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
}

export function buildOsmLocality(tags: Record<string, string>): string {
  return (
    tagValue(tags, [
      "addr:neighbourhood",
      "addr:place",
      "addr:suburb",
      "addr:quarter",
      "addr:city",
      "addr:town",
      "addr:village",
      "addr:district",
      "is_in:neighbourhood",
      "is_in:suburb",
      "is_in:city",
      "is_in"
    ]) || "Nearby area"
  );
}

export function buildOsmFacilities(tags: Record<string, string>): string[] {
  const facilities: string[] = [];

  if (tags.wheelchair === "yes" || tags.wheelchair === "limited") facilities.push("Wheelchair access");
  if (tags.toilets === "yes") facilities.push("Toilets");
  if (tags.parking === "yes" || tags.amenity === "parking") facilities.push("Parking");
  if (tags.wudu === "yes" || tags.ablution === "yes" || tags["toilets:ablution"] === "yes") facilities.push("Wudu");
  if (tags.capacity) facilities.push(`Capacity ${tags.capacity}`);
  if (tags.female === "yes" || tags["prayer:rooms:female"] === "yes") facilities.push("Ladies section");

  return Array.from(new Set(facilities));
}

function hasStrongWorshipSignal(tags: Record<string, string>): boolean {
  return /muslim|islam|mosque|masjid|musalla|musholla|surau|pallivasal/i.test(
    [
      tags.religion,
      tags.denomination,
      tags["building:use"],
      tags.building,
      tags.place_of_worship,
      tags.worship,
      tags.historic,
      tags.landuse === "religious" ? tags.landuse : "",
      tags.amenity === "place_of_worship" ? tags.amenity : "",
      tags.amenity === "prayer_room" ? tags.amenity : ""
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function isStreetOrBoundaryObject(tags: Record<string, string>): boolean {
  return Boolean(
    tags.highway ||
      tags.railway ||
      tags.waterway ||
      tags.route ||
      tags.boundary ||
      Boolean(tags.place) ||
      tags.type === "route" ||
      tags.public_transport === "platform"
  );
}

function isExcludedCommercialOrNonWorship(tags: Record<string, string>): boolean {
  const amenity = tags.amenity?.toLowerCase();
  const shop = tags.shop?.toLowerCase();
  const tourism = tags.tourism?.toLowerCase();
  const office = tags.office?.toLowerCase();
  const leisure = tags.leisure?.toLowerCase();
  const strongReligiousSignals = hasStrongWorshipSignal(tags);

  // Important: a road called “Mosque Street” is not a masjid. Name-only matching
  // caused false positives. Roads, routes, boundaries, and transport objects are
  // accepted only when they also carry a strong worship/religion/building signal.
  if (isStreetOrBoundaryObject(tags) && !strongReligiousSignals) return true;

  if (amenity === "place_of_worship") return false;
  if (strongReligiousSignals) return false;
  if (shop || office || leisure) return true;
  if (tourism && tourism !== "attraction") return true;

  return Boolean(
    amenity &&
      [
        "restaurant",
        "fast_food",
        "cafe",
        "food_court",
        "bar",
        "pub",
        "marketplace",
        "bank",
        "atm",
        "fuel",
        "pharmacy",
        "clinic",
        "hospital",
        "parking",
        "school",
        "college",
        "university",
        "kindergarten"
      ].includes(amenity)
  );
}

export function isLikelyMosqueTags(tags: Record<string, string>): boolean {
  if (isExcludedCommercialOrNonWorship(tags)) return false;

  const name = getBestOsmName(tags);
  const amenity = tags.amenity?.toLowerCase();
  const religion = tags.religion?.toLowerCase();
  const denomination = tags.denomination?.toLowerCase();
  const building = tags.building?.toLowerCase();
  const buildingUse = tags["building:use"]?.toLowerCase();
  const historic = tags.historic?.toLowerCase();
  const placeOfWorship = tags.place_of_worship?.toLowerCase();
  const worship = tags.worship?.toLowerCase();
  const description = tags.description?.toLowerCase();
  const operator = tags.operator?.toLowerCase();
  const keyword = new RegExp(MOSQUE_NAME_REGEX, "i");

  const muslimReligion = matchesAny(religion, /muslim|islam/i) || matchesAny(denomination, /muslim|islam|sunni|shia|shiite|sufi/i);
  const mosqueBuilding = matchesAny(building, /mosque|masjid|musalla|musholla|surau|pallivasal/i) || matchesAny(buildingUse, /mosque|masjid|musalla|musholla|surau|pallivasal/i);
  const mosqueHistoric = matchesAny(historic, /mosque|masjid/i);
  const mosquePlace = matchesAny(placeOfWorship, /mosque|masjid|musalla|musallah|prayer/i) || matchesAny(worship, /muslim|islam|mosque|masjid/i);
  const islamicCommunityCentre = amenity === "community_centre" && (muslimReligion || Boolean(name && nameLooksIslamic(name)));
  const prayerRoom = amenity === "prayer_room" && (muslimReligion || Boolean(name && nameLooksIslamic(name)));
  const religiousLanduse = tags.landuse === "religious" && (muslimReligion || Boolean(name && nameLooksIslamic(name)));

  if (amenity === "place_of_worship" && muslimReligion) return true;
  if (amenity === "place_of_worship" && name && nameLooksIslamic(name)) return true;
  if (mosqueBuilding || mosqueHistoric || mosquePlace || islamicCommunityCentre || prayerRoom || religiousLanduse) return true;
  if (muslimReligion && name && nameLooksIslamic(name)) return true;
  // Name-only matches are useful for unnamed POIs, but dangerous for roads like
  // “Mosque Street”. Require a non-road/non-boundary object before accepting a
  // name-only result.
  if (name && nameLooksIslamic(name) && !isStreetOrBoundaryObject(tags)) return true;
  if ((matchesAny(description, keyword) || matchesAny(operator, keyword)) && !isStreetOrBoundaryObject(tags)) return true;

  return false;
}

export function osmConfidenceFor(tags: Record<string, string>): OsmConfidence {
  const name = getBestOsmName(tags);
  const hasStrongTags =
    (tags.amenity === "place_of_worship" && /muslim|islam/i.test(tags.religion ?? "")) ||
    /mosque|masjid|musalla|musholla|surau|pallivasal/i.test([tags.building, tags["building:use"], tags.place_of_worship, tags.worship].filter(Boolean).join(" "));
  if (name && (nameLooksIslamic(name) || hasStrongTags)) return "named";
  if (name) return "possible";
  return "unnamed";
}

export function discoveryQualityFor(confidence: OsmConfidence, tags: Record<string, string>): DiscoveryQuality {
  const religion = tags.religion?.toLowerCase() ?? "";
  if (confidence === "named" && tags.amenity === "place_of_worship" && /muslim|islam/.test(religion)) return "high";
  if (confidence === "named" && (tags.building === "mosque" || tags["building:use"] === "mosque")) return "high";
  if (confidence === "named") return "medium";
  if (tags.building === "mosque" || tags.amenity === "place_of_worship") return "medium";
  return "low";
}

function displayNameForUnnamedMasjid(tags: Record<string, string>): string {
  const locality = buildOsmLocality(tags);
  if (locality && locality !== "Nearby area") return `Unnamed masjid near ${locality}`;
  return "Unnamed masjid / prayer place";
}

function normaliseOsmType(value: unknown): OsmReference["type"] | undefined {
  if (value === "node" || value === "N") return "node";
  if (value === "way" || value === "W") return "way";
  if (value === "relation" || value === "R") return "relation";
  return undefined;
}

export function osmElementToMasjid(element: OverpassElement): Masjid | undefined {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;

  const tags = element.tags ?? {};
  if (!isLikelyMosqueTags(tags)) return undefined;

  const coordinates = { lat, lng };
  const osmConfidence = osmConfidenceFor(tags);
  const bestName = getBestOsmName(tags);
  const name = bestName && osmConfidence !== "unnamed" ? bestName : displayNameForUnnamedMasjid(tags);

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    locality: buildOsmLocality(tags),
    address: buildOsmAddress(tags, coordinates),
    coordinates,
    phone: text(tags.phone) || text(tags["contact:phone"]),
    facilities: buildOsmFacilities(tags),
    khutbahLanguages: [],
    verificationStatus: "osm_discovered",
    lastVerifiedAt: "OpenStreetMap",
    jamaat: FALLBACK_JAMAAT,
    jumuah: [],
    source: "openstreetmap",
    osm: { type: element.type, id: element.id },
    osmConfidence,
    discoveryQuality: discoveryQualityFor(osmConfidence, tags),
    notes:
      osmConfidence === "named"
        ? "Discovered from OpenStreetMap. Jamaat timings are not available until a local user or masjid admin verifies them."
        : "Discovered from OpenStreetMap, but this object has no clear public masjid name. Confirm the pin, then submit the correct name and jamaat timings."
  };
}

function nominatimAddressToTags(item: NominatimSearchItem): Record<string, string> {
  const tags: Record<string, string> = { ...(item.extratags ?? {}) };
  const address = item.address ?? {};
  const namedetails = item.namedetails ?? {};

  const name = item.name || namedetails.name || namedetails["name:en"] || namedetails.official_name;
  if (name) tags.name = String(name);
  for (const [key, value] of Object.entries(namedetails)) {
    if (typeof value === "string" && !tags[key]) tags[key] = value;
  }

  if (item.class === "highway" || /^(road|street|residential|service|tertiary|secondary|primary)$/i.test(String(item.type ?? ""))) tags.highway = String(item.type || "road");
  if (item.class === "boundary") tags.boundary = String(item.type || "administrative");
  if (item.class === "place" && /^(neighbourhood|suburb|quarter|city|town|village)$/i.test(String(item.type ?? ""))) tags.place = String(item.type);

  if (item.class === "amenity" && item.type === "place_of_worship") tags.amenity = "place_of_worship";
  if (item.type === "mosque") {
    tags.amenity = tags.amenity || "place_of_worship";
    tags.religion = tags.religion || "muslim";
  }
  if (item.class === "building" && item.type === "mosque") tags.building = "mosque";

  if (address.road) tags["addr:street"] = String(address.road);
  if (address.neighbourhood) tags["addr:neighbourhood"] = String(address.neighbourhood);
  if (address.suburb) tags["addr:suburb"] = String(address.suburb);
  if (address.city || address.town || address.village) tags["addr:city"] = String(address.city || address.town || address.village);
  if (address.state) tags["addr:state"] = String(address.state);
  if (address.postcode) tags["addr:postcode"] = String(address.postcode);

  return tags;
}

export function nominatimItemToMasjid(item: NominatimSearchItem): Masjid | undefined {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const type = normaliseOsmType(item.osm_type);
  const osmId = Number(item.osm_id);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !type || !Number.isFinite(osmId)) return undefined;

  const coordinates = { lat, lng };
  const tags = nominatimAddressToTags(item);
  if (!isLikelyMosqueTags(tags)) return undefined;

  const confidence = osmConfidenceFor(tags);
  const bestName = getBestOsmName(tags) || text(item.name) || text(item.display_name?.split(",")[0]);
  const name = bestName && confidence !== "unnamed" ? bestName : displayNameForUnnamedMasjid(tags);

  return {
    id: `osm-${type}-${osmId}`,
    name,
    locality: buildOsmLocality(tags),
    address: text(item.display_name) || buildOsmAddress(tags, coordinates),
    coordinates,
    phone: text(tags.phone) || text(tags["contact:phone"]),
    facilities: buildOsmFacilities(tags),
    khutbahLanguages: [],
    verificationStatus: "osm_discovered",
    lastVerifiedAt: "OpenStreetMap search",
    jamaat: FALLBACK_JAMAAT,
    jumuah: [],
    source: "openstreetmap",
    osm: { type, id: osmId },
    osmConfidence: confidence,
    discoveryQuality: discoveryQualityFor(confidence, tags),
    notes: "Found through OpenStreetMap place search. Verify the exact pin and jamaat timings before showing countdowns."
  };
}
