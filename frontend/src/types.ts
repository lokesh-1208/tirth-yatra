export type User = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  faith: string | null;
  sect: string | null;
  language: string;
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
  is_saved: boolean;
};

export type RoutePlace = Place & { detour_km: number; distance_from_start_km: number };

export type GeoPoint = { label: string; lat: number; lng: number };

export type RouteResult = {
  start: string;
  end: string;
  start_point: GeoPoint;
  end_point: GeoPoint;
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

export type Yatra = {
  id: string;
  name: string;
  start: string;
  end: string;
  total_km: number;
  duration_min: number | null;
  created_at: string;
  stops: YatraStop[];
};
