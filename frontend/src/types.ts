export type User = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  faith: string | null;
  sect: string | null;
  language: string;
  /** "curator" can open the admin section. */
  role?: "pilgrim" | "curator" | null;
};

export type Place = {
  id: number;
  name: string;
  faith: string;
  sect: string | null;
  kind: string;
  deity: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
  how_to_reach: string | null;
  photo_url: string | null;
  // Detail fields (placeholders until verified data is added)
  darshan_timings: string | null;
  contact_phone: string | null;
  stay_info: string | null;
  food_info: string | null;
  verified: boolean;
  verified_by: string | null;
  verified_on: string | null;
  verified_method?: CheckMethod | null;
  address?: string | null;
  district?: string | null;
  /** Directions that work without network. */
  landmarks?: string | null;
  /** Only people who agreed to be shown. */
  contacts?: PublicContact[];
  /** Language the text fields are in (falls back to the default language). */
  language?: string;
  is_saved: boolean;
};

export type PublicContact = { name: string; role: string; phone: string };

export type RoutePlace = Place & { detour_km: number; distance_from_start_km: number };

export type GeoPoint = { label: string; lat: number; lng: number };

/** A stop the pilgrim chose between start and end ("break journey"). */
export type RouteStop = GeoPoint & { distance_from_start_km: number };

export type RouteResult = {
  start: string;
  end: string;
  start_point: GeoPoint;
  end_point: GeoPoint;
  stops: RouteStop[]; // in travel order; empty for a direct trip
  total_km: number;
  duration_min: number | null;
  source: "road" | "straight";
  geometry: [number, number][]; // (lat, lng) polyline
  max_detour_km: number;
  places: RoutePlace[];
};

export type AuthResponse = { access_token: string; token_type: string; user: User; is_new_user: boolean };
export type OtpSent = { message: string; identifier: string; expires_in_seconds: number };

export type YatraStop = {
  place_id: number;
  name: string;
  city: string | null;
  kind: string;
  distance_from_start_km: number;
  detour_km: number;
  visited: boolean;
};

/** A break-journey stop saved with a yatra. */
export type YatraBreak = { label: string; distance_from_start_km: number };

export type Yatra = {
  id: string;
  name: string;
  start: string;
  end: string;
  /** Break-journey stops in travel order. Missing on yatras saved before this feature. */
  via?: YatraBreak[];
  total_km: number;
  duration_min: number | null;
  created_at: string;
  stops: YatraStop[];
};

// ---------------------------------------------------------------------------------------------
// Admin (curator) section
// ---------------------------------------------------------------------------------------------

export type PlaceStatus = "draft" | "in_review" | "live" | "hidden";
export type CheckMethod = "call" | "visit" | "local_reference";
export type ContactRole = "manager" | "pujari" | "trustee" | "other";
export type LeadStatus = "to_call" | "called" | "drafted" | "rejected";
export type Sect = "digambar" | "shvetambar" | "all";
export type PlaceKind = "tirth" | "siddha_kshetra" | "atishay_kshetra" | "temple" | "dharamshala";

/** Text fields that are stored per language. */
export type TranslatableFields = {
  name: string | null;
  description: string | null;
  how_to_reach: string | null;
  darshan_timings: string | null;
  stay_info: string | null;
  food_info: string | null;
  landmarks: string | null;
};

export type Translation = TranslatableFields & { language: string };

export type AdminContact = {
  id: number;
  name: string;
  role: ContactRole;
  phone: string;
  consent_on: string | null;
  show_publicly: boolean;
};

export type AdminPhoto = {
  id: number;
  url: string;
  caption: string | null;
  photographer: string | null;
  permission_note: string | null;
  is_cover: boolean;
  created_at: string;
};

export type AdminCheck = {
  id: number;
  method: CheckMethod;
  checked_with: string | null;
  confirmed: string | null;
  checked_on: string;
  recheck_after_months: number;
  checked_by_name: string | null;
  created_at: string;
};

export type AdminPlaceSummary = {
  id: number;
  name: string;
  city: string | null;
  district: string | null;
  sect: string | null;
  kind: string;
  status: PlaceStatus;
  verified: boolean;
  verified_on: string | null;
  recheck_due: string | null;
  cover_url: string | null;
};

export type AdminPlace = AdminPlaceSummary &
  TranslatableFields & {
    name: string;
    faith: string;
    deity: string | null;
    state: string | null;
    address: string | null;
    pincode: string | null;
    latitude: number;
    longitude: number;
    verified_by: string | null;
    verified_method: CheckMethod | null;
    updated_at: string | null;
    default_language: string;
    translations: Translation[];
    contacts: AdminContact[];
    photos: AdminPhoto[];
    checks: AdminCheck[];
  };

/** Fields the place editor can send (all optional on update). */
export type PlaceInput = Partial<{
  name: string;
  latitude: number;
  longitude: number;
  faith: string;
  sect: Sect | null;
  kind: PlaceKind;
  deity: string | null;
  description: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  address: string | null;
  pincode: string | null;
  how_to_reach: string | null;
  darshan_timings: string | null;
  stay_info: string | null;
  food_info: string | null;
  landmarks: string | null;
}>;

export type AdminSummary = {
  counts: Record<PlaceStatus, number>;
  recheck_due: number;
  open_leads: number;
  due_places: AdminPlaceSummary[];
  recent_checks: { place_id: number; place_name: string; method: CheckMethod; checked_on: string; checked_by_name: string | null }[];
};

export type Lead = {
  id: number;
  name: string;
  area: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  place_id: number | null;
  created_at: string;
  updated_at: string;
};
