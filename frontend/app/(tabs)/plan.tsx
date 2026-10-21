import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { api } from "../../src/api";
import { PlaceCard } from "../../src/PlaceCard";
import { colors, spacing } from "../../src/theme";
import type { RouteResult } from "../../src/types";
import { Button, Chip, Empty, ErrorText, Input } from "../../src/ui";

const DETOURS = [10, 25, 50];

export default function PlanRoute() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [detour, setDetour] = useState(25);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    setError("");
    if (!start.trim() || !end.trim()) return setError("Enter both a start and a destination.");
    setLoading(true);
    try {
      setResult(await api.route({ start: start.trim(), end: end.trim(), max_detour_km: detour }));
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
          <Input testID="route-start" label="From" value={start} onChangeText={setStart} placeholder="e.g. Jabalpur" />
          <Input testID="route-end" label="To" value={end} onChangeText={setEnd} placeholder="e.g. Nemawar" />
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
            <Text testID="route-summary" style={styles.summary}>
              {result.start} → {result.end} · {result.total_km} km (straight line) · {result.places.length} place
              {result.places.length === 1 ? "" : "s"} found
            </Text>
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
