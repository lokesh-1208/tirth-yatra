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
  verified: boolean;
  verified_by: string | null;
  verified_on: string | null;
  is_saved: boolean;
};

export type RoutePlace = Place & { detour_km: number; distance_from_start_km: number };

export type RouteResult = {
  start: string;
  end: string;
  total_km: number;
  max_detour_km: number;
  places: RoutePlace[];
};

export type AuthResponse = { access_token: string; token_type: string; user: User; is_new_user: boolean };
export type OtpSent = { message: string; identifier: string; expires_in_seconds: number };
