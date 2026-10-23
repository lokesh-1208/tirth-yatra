import { buildQuery as qs } from "./routeStops";
import type {
  AdminContact,
  AdminPhoto,
  AdminPlace,
  AdminPlaceSummary,
  AdminSummary,
  AuthResponse,
  CheckMethod,
  ContactRole,
  GeoPoint,
  Lead,
  LeadStatus,
  OtpSent,
  Place,
  PlaceInput,
  PlaceStatus,
  RouteResult,
  TranslatableFields,
  User,
} from "./types";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/**
 * Map tiles for the Leaflet maps. By default they come through our backend (/tiles), which identifies
 * the app to OpenStreetMap and caches tiles. Set EXPO_PUBLIC_MAP_TILE_URL to use another provider.
 */
export const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL ?? `${API_URL}/tiles/{z}/{x}/{y}.png`;

/** Uploaded files come back as "/uploads/..." paths on the API host. */
export const assetUrl = (path: string | null | undefined): string | null =>
  !path ? null : /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setToken = (t: string | null) => {
  token = t;
};
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // FormData (photo uploads) sets its own multipart Content-Type with the boundary.
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = isForm ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers as object) } });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your internet connection and API URL.");
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    let message = "Something went wrong";
    if (body?.detail) {
      message = typeof body.detail === "string" ? body.detail : body.detail[0]?.msg ?? message;
    }
    throw new ApiError(res.status, message);
  }
  return body as T;
}

export const api = {
  requestOtp: (identifier: string) =>
    request<OtpSent>("/auth/otp/request", { method: "POST", body: JSON.stringify({ identifier }) }),
  verifyOtp: (identifier: string, otp: string) =>
    request<AuthResponse>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ identifier, otp }) }),
  me: () => request<User>("/auth/me"),
  updateMe: (data: Partial<Pick<User, "name" | "faith" | "sect" | "language">>) =>
    request<User>("/auth/me", { method: "PATCH", body: JSON.stringify(data) }),

  places: (params: { q?: string; sect?: string; faith?: string; kind?: string } = {}) =>
    request<Place[]>(`/places${qs(params)}`),
  place: (id: number | string) => request<Place>(`/places/${id}`),
  saved: () => request<Place[]>("/places/saved"),
  save: (id: number) => request<void>(`/places/${id}/save`, { method: "POST" }),
  unsave: (id: number) => request<void>(`/places/${id}/save`, { method: "DELETE" }),
  geocode: (q: string) => request<GeoPoint[]>(`/geocode${qs({ q })}`),
  // `via`: stops between start and end, in travel order ("break journey").
  route: (params: { start: string; end: string; via?: string[]; max_detour_km?: number; sect?: string }) =>
    request<RouteResult>(`/route${qs(params)}`),
};

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Admin section (curators only). */
export const adminApi = {
  summary: () => request<AdminSummary>("/admin/summary"),
  places: (params: { q?: string; status?: PlaceStatus; recheck_due?: boolean } = {}) =>
    request<AdminPlaceSummary[]>(`/admin/places${qs(params)}`),
  place: (id: number | string) => request<AdminPlace>(`/admin/places/${id}`),
  createPlace: (data: PlaceInput & { name: string; latitude: number; longitude: number; lead_id?: number }) =>
    request<AdminPlace>("/admin/places", json("POST", data)),
  updatePlace: (id: number, data: PlaceInput) => request<AdminPlace>(`/admin/places/${id}`, json("PATCH", data)),
  setStatus: (id: number, status: PlaceStatus) => request<AdminPlace>(`/admin/places/${id}/status`, json("POST", { status })),

  saveTranslation: (id: number, language: string, data: Partial<TranslatableFields>) =>
    request<AdminPlace>(`/admin/places/${id}/translations/${language}`, json("PUT", data)),
  deleteTranslation: (id: number, language: string) =>
    request<AdminPlace>(`/admin/places/${id}/translations/${language}`, json("DELETE")),

  addContact: (id: number, data: { name: string; role: ContactRole; phone: string; consent_on: string | null; show_publicly: boolean }) =>
    request<AdminContact>(`/admin/places/${id}/contacts`, json("POST", data)),
  updateContact: (id: number, contactId: number, data: Partial<Omit<AdminContact, "id">>) =>
    request<AdminContact>(`/admin/places/${id}/contacts/${contactId}`, json("PATCH", data)),
  deleteContact: (id: number, contactId: number) => request<void>(`/admin/places/${id}/contacts/${contactId}`, json("DELETE")),

  uploadPhoto: (
    id: number,
    file: Blob,
    fileName: string,
    meta: { no_deity_confirmed: boolean; caption?: string; photographer?: string; permission_note?: string; make_cover?: boolean }
  ) => {
    const form = new FormData();
    form.append("file", file, fileName);
    Object.entries(meta).forEach(([k, v]) => {
      if (v !== undefined && v !== "") form.append(k, String(v));
    });
    return request<AdminPhoto>(`/admin/places/${id}/photos`, { method: "POST", body: form });
  },
  updatePhoto: (id: number, photoId: number, data: Partial<Pick<AdminPhoto, "caption" | "photographer" | "permission_note" | "is_cover">>) =>
    request<AdminPhoto>(`/admin/places/${id}/photos/${photoId}`, json("PATCH", data)),
  deletePhoto: (id: number, photoId: number) => request<void>(`/admin/places/${id}/photos/${photoId}`, json("DELETE")),

  logCheck: (
    id: number,
    data: { method: CheckMethod; checked_with?: string; confirmed?: string; checked_on?: string; recheck_after_months: number }
  ) => request<AdminPlace>(`/admin/places/${id}/checks`, json("POST", data)),

  leads: (status?: LeadStatus) => request<Lead[]>(`/admin/leads${qs({ status })}`),
  addLead: (data: { name: string; area?: string; source?: string; notes?: string }) => request<Lead>("/admin/leads", json("POST", data)),
  updateLead: (leadId: number, data: Partial<Pick<Lead, "name" | "area" | "source" | "notes" | "status">>) =>
    request<Lead>(`/admin/leads/${leadId}`, json("PATCH", data)),
};
