import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";

import { api } from "../../src/api";
import { LocationInput } from "../../src/LocationInput";
import { PlaceCard } from "../../src/PlaceCard";
import { RouteMap } from "../../src/RouteMap";
import { colors, fontFamily, radius, spacing } from "../../src/theme";
import type { GeoPoint, Place, RouteResult } from "../../src/types";
import { Button, Chip, Empty, ErrorText, PageHeader, SectionHeader } from "../../src/ui";
import { useYatras } from "../../src/yatras";

const DETOURS = [10, 25, 50];

const formatDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

export default function PlanRoute() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startPoint, setStartPoint] = useState<GeoPoint | null>(null);
  const [endPoint, setEndPoint] = useState<GeoPoint | null>(null);
  const [detour, setDetour] = useState(25);
  const [labels, setLabels] = useState<{ start: string; end: string } | null>(null); // names shown in the summary
  const router = useRouter();
  const { createFromRoute } = useYatras();
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingYatra, setSavingYatra] = useState(false);
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

  const swap = () => {
    setStart(end);
    setEnd(start);
    setStartPoint(endPoint);
    setEndPoint(startPoint);
  };

  const toggleSave = async (p: Place) => {
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

  const saveAsYatra = async () => {
    if (!result || !labels) return;
    setSavingYatra(true);
    try {
      const y = await createFromRoute(result, labels);
      router.push(`/yatra/${y.id}`);
    } finally {
      setSavingYatra(false);
    }
  };

  const short = (s: string) => s.split(",")[0];

  return (
    <FlatList
      testID="route-list"
      data={result?.places ?? []}
      keyExtractor={(p) => String(p.id)}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      ListHeaderComponent={
        <View>
          <PageHeader title="Plan your yatra" subtitle="Find every tirth along your road" />
          <View style={{ paddingHorizontal: spacing.md }}>
            <Card mode="elevated" elevation={2} style={styles.formCard}>
              <Card.Content>
                <LocationInput
                  testID="route-start"
                  label="From"
                  icon="map-marker-outline"
                  value={start}
                  onChangeText={setStart}
                  onPick={setStartPoint}
                  placeholder="e.g. Jabalpur"
                />
                <View style={styles.swapRow}>
                  <View style={styles.line} />
                  <Button testID="route-swap" title="Swap" variant="text" icon="swap-vertical" onPress={swap} />
                  <View style={styles.line} />
                </View>
                <LocationInput
                  testID="route-end"
                  label="To"
                  icon="flag-checkered"
                  value={end}
                  onChangeText={setEnd}
                  onPick={setEndPoint}
                  placeholder="e.g. Nemawar"
                />
                <Text variant="labelLarge" style={styles.label}>
                  Max detour from the route
                </Text>
                <View style={{ flexDirection: "row", marginBottom: spacing.md }}>
                  {DETOURS.map((d) => (
                    <Chip key={d} testID={`detour-${d}`} label={`${d} km`} selected={detour === d} onPress={() => setDetour(d)} />
                  ))}
                </View>
                <ErrorText testID="route-error">{error}</ErrorText>
                <Button
                  testID="route-submit"
                  title="Find places on my route"
                  icon="magnify"
                  onPress={search}
                  loading={loading}
                />
              </Card.Content>
            </Card>

            {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}

            {result && (
              <>
                <View style={styles.summary}>
                  <Text testID="route-summary" variant="titleMedium" style={styles.summaryTitle}>
                    {labels?.start ?? result.start} → {labels?.end ?? result.end} · {result.total_km} km
                    {result.source === "road" ? "" : " (straight line)"}
                    {result.duration_min ? ` · ${formatDuration(result.duration_min)} drive` : ""} · {result.places.length} place
                    {result.places.length === 1 ? "" : "s"} found
                  </Text>
                  <View style={styles.stats}>
                    <Stat icon="road-variant" value={`${result.total_km} km`} label="Distance" />
                    <Stat icon="clock-outline" value={result.duration_min ? formatDuration(result.duration_min) : "—"} label="Drive" />
                    <Stat icon="map-marker-multiple" value={String(result.places.length)} label="Places" />
                  </View>
                  <Button
                    testID="route-save-yatra"
                    title={`Save as yatra: ${short(labels?.start ?? result.start)} to ${short(labels?.end ?? result.end)}`}
                    icon="bag-personal-outline"
                    variant="tonal"
                    onPress={saveAsYatra}
                    loading={savingYatra}
                    disabled={result.places.length === 0}
                  />
                </View>
                <RouteMap route={result} places={result.places} onSelectPlace={(id) => router.push(`/place/${id}`)} />
                {result.places.length > 0 && <SectionHeader title="On your way" />}
              </>
            )}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: spacing.md }}>
          <PlaceCard place={item} onToggleSave={toggleSave} />
        </View>
      )}
      ListEmptyComponent={
        result ? <Empty title="No places on this route" hint="Try a larger detour distance." icon="map-marker-off-outline" /> : null
      }
    />
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <MaterialCommunityIcons name={icon as any} size={20} color={colors.primary} />
      <Text variant="titleMedium" style={{ fontFamily: fontFamily.bold, marginTop: 2 }}>
        {value}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.muted }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  formCard: { marginTop: -spacing.lg, borderRadius: radius.lg, backgroundColor: colors.card },
  swapRow: { flexDirection: "row", alignItems: "center", marginTop: -spacing.sm, marginBottom: spacing.xs },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  label: { color: colors.text, marginBottom: spacing.sm },
  summary: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: { color: colors.primaryDark, fontFamily: fontFamily.semibold },
  stats: { flexDirection: "row", marginVertical: spacing.md },
  stat: { flex: 1, alignItems: "center" },
});
