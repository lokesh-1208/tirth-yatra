import type { AuthResponse, OtpSent, Place, RouteResult, User } from "./types";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
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

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

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
  route: (params: { start: string; end: string; max_detour_km?: number; sect?: string }) =>
    request<RouteResult>(`/route${qs(params)}`),
};
