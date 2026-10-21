import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { api } from "../../src/api";
import { LocationInput } from "../../src/LocationInput";
import { PlaceCard } from "../../src/PlaceCard";
import { RouteMap } from "../../src/RouteMap";
import { colors, spacing } from "../../src/theme";
import type { GeoPoint, RouteResult } from "../../src/types";
import { Button, Chip, Empty, ErrorText } from "../../src/ui";

const DETOURS = [10, 25, 50];

const formatDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m drive` : `${m}m drive`;
};

export default function PlanRoute() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startPoint, setStartPoint] = useState<GeoPoint | null>(null);
  const [endPoint, setEndPoint] = useState<GeoPoint | null>(null);
  const [detour, setDetour] = useState(25);
  const [labels, setLabels] = useState<{ start: string; end: string } | null>(null); // names shown in the summary
  const router = useRouter();
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    setError("");
    if (!start.trim() || !end.trim()) return setError("Enter both a start and a destination.");
    setLoading(true);
    try {
      // A picked suggestion is sent as exact coordinates so the backend doesn't re-guess an ambiguous name.
      const at = (p: GeoPoint | null, text: string) => (p ? `${p.lat},${p.lng}` : text.trim());
      const res = await api.route({ start: at(startPoint, start), end: at(endPoint, end), max_detour_km: detour });
      setLabels({ start: startPoint?.label ?? res.start, end: endPoint?.label ?? res.end });
      setResult(res);
    } catch (e: any) {
      setResult(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = async (p: any) => {
    if (!result) return;
    const flip = (val: boolean) =>
      setResult({ ...result, places: result.places.map((x) => (x.id === p.id ? { ...x, is_saved: val } : x)) });
    flip(!p.is_saved);
    try {
      await (p.is_saved ? api.unsave(p.id) : api.save(p.id));
    } catch (e: any) {
      flip(p.is_saved);
      setError(e.message);
    }
  };

  return (
    <FlatList
      testID="route-list"
      contentContainerStyle={{ padding: spacing.md }}
      data={result?.places ?? []}
      keyExtractor={(p) => String(p.id)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <LocationInput
            testID="route-start"
            label="From"
            value={start}
            onChangeText={setStart}
            onPick={setStartPoint}
            placeholder="e.g. Jabalpur"
          />
          <LocationInput
            testID="route-end"
            label="To"
            value={end}
            onChangeText={setEnd}
            onPick={setEndPoint}
            placeholder="e.g. Palitana"
          />
          <Text style={styles.label}>Max detour from the route</Text>
          <View style={{ flexDirection: "row", marginBottom: spacing.md }}>
            {DETOURS.map((d) => (
              <Chip key={d} testID={`detour-${d}`} label={`${d} km`} selected={detour === d} onPress={() => setDetour(d)} />
            ))}
          </View>
          <ErrorText testID="route-error">{error}</ErrorText>
          <Button testID="route-submit" title="Find places on my route" onPress={search} loading={loading} />
          {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}
          {result && (
            <>
              <Text testID="route-summary" style={styles.summary}>
                {labels?.start ?? result.start} → {labels?.end ?? result.end} · {result.total_km} km
                {result.source === "road" ? "" : " (straight line)"}
                {result.duration_min ? ` · ${formatDuration(result.duration_min)}` : ""} · {result.places.length} place
                {result.places.length === 1 ? "" : "s"} found
              </Text>
              <RouteMap route={result} places={result.places} onSelectPlace={(id) => router.push(`/place/${id}`)} />
              <View style={{ height: spacing.md }} />
            </>
          )}
        </View>
      }
      renderItem={({ item }) => <PlaceCard place={item} onToggleSave={toggleSave} />}
      ListEmptyComponent={
        result ? <Empty title="No places on this route" hint="Try a larger detour distance." /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 },
  summary: { marginVertical: spacing.md, color: colors.primaryDark, fontWeight: "600" },
});
