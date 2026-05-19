export type SalahKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export type Coordinates = {
  lat: number;
  lng: number;
};

export type VerificationStatus =
  | "admin_verified"
  | "community_checked"
  | "demo_unverified"
  | "osm_discovered"
  | "google_discovered"
  | "mappls_discovered"
  | "foursquare_discovered";

export type ListingSource = "firestore" | "openstreetmap" | "google_places" | "mappls" | "foursquare" | "demo" | "community_report";

export type OsmReference = {
  type: "node" | "way" | "relation";
  id: number;
};

export type OsmConfidence = "named" | "unnamed" | "possible";
export type DiscoveryQuality = "high" | "medium" | "low";

export type MasjidVerificationChecklist = {
  nameChecked: boolean;
  addressChecked: boolean;
  pinChecked: boolean;
  routeTested: boolean;
  timingsChecked: boolean;
  contactChecked: boolean;
};

export type Masjid = {
  id: string;
  name: string;
  locality: string;
  address: string;
  coordinates: Coordinates;
  phone?: string;
  facilities: string[];
  khutbahLanguages: string[];
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string;
  jamaat: Record<SalahKey, string>;
  jumuah: string[];
  notes?: string;
  source?: ListingSource;
  osm?: OsmReference;
  osmConfidence?: OsmConfidence;
  googlePlaceId?: string;
  googleMapsUri?: string;
  mapplsELoc?: string;
  foursquareId?: string;
  /** Distance reported by provider when exact lat/lng is unavailable or as a stronger sort hint. */
  providerDistanceMeters?: number;
  /** True when coordinates are only a search-center placeholder and must not be used for direct routing. */
  coordinatesApproximate?: boolean;
  providerUrl?: string;
  providerConfidence?: number;
  // All provider sources that matched this same likely masjid after de-duplication.
  // Example: ["foursquare", "mappls", "openstreetmap"]. Used to show that
  // multiple discovery layers agree without repeating the same masjid card.
  providerSources?: ListingSource[];
  discoveryQuality?: DiscoveryQuality;
  navigationVerified?: boolean;
  verificationChecklist?: MasjidVerificationChecklist;
  verificationNotes?: string;
  verifiedBy?: string;
  assignedAdminIds?: string[];
  lastNavigationTestAt?: string;
};

export type NextJamaat = {
  salah: SalahKey;
  displayName: string;
  time: string;
  startsAt: Date;
  minutesUntil: number;
  isTomorrow: boolean;
};

export type DataSource = "firebase" | "demo" | "empty" | "error" | "local_discovery";

export type MasjidListResult = {
  masjids: Masjid[];
  source: DataSource;
  message?: string;
};

export type TimingUpdate = {
  jamaat: Record<SalahKey, string>;
  jumuah: string[];
};

export type SuggestionField = "jamaat" | "jumuah" | "facility" | "address" | "phone" | "other";
export type SuggestionStatus = "pending" | "approved" | "rejected";
export type ClaimStatus = "pending" | "approved" | "rejected";

export type SuggestionInput = {
  masjidId: string;
  field: SuggestionField;
  suggestedValue: string;
  notes?: string;
  masjidSnapshot?: Pick<
    Masjid,
    | "id"
    | "name"
    | "locality"
    | "address"
    | "coordinates"
    | "source"
    | "osm"
    | "osmConfidence"
    | "googlePlaceId"
    | "googleMapsUri"
    | "mapplsELoc"
    | "foursquareId"
    | "providerUrl"
    | "providerConfidence"
    | "discoveryQuality"
  >;
};

export type Suggestion = SuggestionInput & {
  id: string;
  status: SuggestionStatus;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type ClaimRequestInput = {
  masjidId: string;
  masjidName: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail?: string;
  role: string;
  proof: string;
  notes?: string;
};

export type ClaimRequest = ClaimRequestInput & {
  id: string;
  status: ClaimStatus;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  assignedAdminUid?: string;
  assignedAdminEmail?: string;
  verificationNotes?: string;
};

export type TrustLevel = "verified" | "strong" | "medium" | "low";

export type TrustScore = {
  score: number;
  level: TrustLevel;
  label: string;
  reasons: string[];
};


export type AdminRole = "owner" | "reviewer" | "masjid_admin";

export type AdminProfile = {
  id: string;
  email?: string;
  role: AdminRole;
  masjidIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  createdFromClaimId?: string;
};

export type AuditAction =
  | "masjid_upsert"
  | "timing_update"
  | "suggestion_approved"
  | "suggestion_rejected"
  | "claim_status_changed"
  | "claim_approved_assigned"
  | "masjid_verified"
  | "admin_profile_upsert"
  | "masjid_deleted";

export type AuditLog = {
  id: string;
  action: AuditAction;
  targetId: string;
  targetCollection: "masjids" | "suggestions" | "claimRequests" | "jamaatTimings" | "admins";
  actorId?: string;
  createdAt?: string;
  summary: string;
};
