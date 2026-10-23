import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "./auth";
import type { RouteResult, Yatra } from "./types";

/**
 * "My Yatras": routes the user saved as trips, with a visited checkbox per stop.
 * Stored on the device for now (works offline, which pilgrims often are).
 * TODO(backend): add /yatras endpoints and sync, so trips follow the user across devices.
 */

type YatraState = {
  yatras: Yatra[];
  ready: boolean;
  /** `labels.via`: names for the break-journey stops, in order (defaults to the names the API returned). */
  createFromRoute: (route: RouteResult, labels: { start: string; end: string; via?: string[] }) => Promise<Yatra>;
  toggleVisited: (yatraId: string, placeId: number) => Promise<void>;
  rename: (yatraId: string, name: string) => Promise<void>;
  remove: (yatraId: string) => Promise<void>;
};

const YatraContext = createContext<YatraState | null>(null);

const keyFor = (userId: number) => `ty_yatras_${userId}`;
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function YatraProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [yatras, setYatras] = useState<Yatra[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    setYatras([]);
    if (!user) return;
    AsyncStorage.getItem(keyFor(user.id))
      .then((raw) => {
        if (active) setYatras(raw ? JSON.parse(raw) : []);
      })
      .catch(() => {
        /* corrupt or unavailable storage: start empty */
      })
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, [user]);

  const persist = useCallback(
    async (next: Yatra[]) => {
      setYatras(next);
      if (user) await AsyncStorage.setItem(keyFor(user.id), JSON.stringify(next)).catch(() => undefined);
    },
    [user]
  );

  const value = useMemo<YatraState>(
    () => ({
      yatras,
      ready,
      createFromRoute: async (route, labels) => {
        const short = (s: string) => s.split(",")[0].trim();
        const yatra: Yatra = {
          id: newId(),
          name: `${short(labels.start)} to ${short(labels.end)}`,
          start: labels.start,
          end: labels.end,
          via: (route.stops ?? []).map((st, i) => ({
            label: labels.via?.[i] ?? st.label,
            distance_from_start_km: st.distance_from_start_km,
          })),
          total_km: route.total_km,
          duration_min: route.duration_min,
          created_at: new Date().toISOString(),
          stops: [...route.places]
            .sort((a, b) => a.distance_from_start_km - b.distance_from_start_km)
            .map((p) => ({
              place_id: p.id,
              name: p.name,
              city: p.city,
              kind: p.kind,
              distance_from_start_km: p.distance_from_start_km,
              detour_km: p.detour_km,
              visited: false,
            })),
        };
        await persist([yatra, ...yatras]);
        return yatra;
      },
      toggleVisited: async (yatraId, placeId) =>
        persist(
          yatras.map((y) =>
            y.id !== yatraId
              ? y
              : { ...y, stops: y.stops.map((s) => (s.place_id === placeId ? { ...s, visited: !s.visited } : s)) }
          )
        ),
      rename: async (yatraId, name) => persist(yatras.map((y) => (y.id === yatraId ? { ...y, name } : y))),
      remove: async (yatraId) => persist(yatras.filter((y) => y.id !== yatraId)),
    }),
    [yatras, ready, persist]
  );

  return <YatraContext.Provider value={value}>{children}</YatraContext.Provider>;
}

export function useYatras() {
  const ctx = useContext(YatraContext);
  if (!ctx) throw new Error("useYatras must be used inside YatraProvider");
  return ctx;
}
