import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatDate, recheckLabel, STATUS_LABEL } from "../../src/admin";
import { CoverThumb, StatusPill, to } from "../../src/adminUi";
import { adminApi } from "../../src/api";
import { colors, fontFamily, KIND_LABEL, radius, spacing } from "../../src/theme";
import type { AdminPlaceSummary, PlaceStatus } from "../../src/types";
import { Button, Chip, Empty, ErrorText, Input } from "../../src/ui";

type Filter = PlaceStatus | "all" | "recheck";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: STATUS_LABEL.draft },
  { value: "in_review", label: STATUS_LABEL.in_review },
  { value: "live", label: STATUS_LABEL.live },
  { value: "hidden", label: STATUS_LABEL.hidden },
  { value: "recheck", label: "Re-check due" },
];

export default function AdminPlaces() {
  const params = useLocalSearchParams<{ status?: string; recheck?: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(params.recheck ? "recheck" : ((params.status as Filter) ?? "all"));
  const [q, setQ] = useState("");
  const [query, setQuery] = useState(""); // debounced search text
  const [places, setPlaces] = useState<AdminPlaceSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setError("");
    try {
      setPlaces(
        await adminApi.places({
          q: query || undefined,
          status: filter !== "all" && filter !== "recheck" ? filter : undefined,
          recheck_due: filter === "recheck" ? true : undefined,
        })
      );
    } catch (e: any) {
      setError(e.message);
    }
  }, [filter, query]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <FlatList
      testID="admin-places-list"
      data={places ?? []}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <View style={styles.headRow}>
            <Text variant="headlineSmall" style={{ flex: 1 }}>
              Places
            </Text>
            <Button testID="admin-places-add" title="Add a place" icon="plus" onPress={() => router.push(to("/admin/place/new"))} />
          </View>
          <Input testID="admin-places-search" label="Search name, town or district" left="magnify" value={q} onChangeText={setQ} />
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f.value} testID={`admin-places-filter-${f.value}`} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </View>
          <ErrorText testID="admin-places-error">{error}</ErrorText>
          {!places && !error && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable testID={`admin-place-row-${item.id}`} style={styles.row} onPress={() => router.push(to(`/admin/place/${item.id}`))}>
          <View style={{ width: 72 }}>
            <CoverThumb url={item.cover_url} name={item.name} kind={item.kind} sect={item.sect} height={52} compact />
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 16 }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.muted }} numberOfLines={1}>
              {[KIND_LABEL[item.kind] ?? item.kind, item.city, item.district].filter(Boolean).join(" · ")}
            </Text>
            <Text variant="bodySmall" style={{ color: item.verified ? colors.success : colors.warnText }}>
              {item.verified ? `Checked ${formatDate(item.verified_on)} · ${recheckLabel(item.recheck_due)}` : "Not checked yet"}
            </Text>
          </View>
          <StatusPill status={item.status} testID={`admin-place-status-${item.id}`} />
        </Pressable>
      )}
      ListEmptyComponent={
        places ? (
          <Empty
            testID="admin-places-empty"
            icon="map-marker-plus-outline"
            title="No places here"
            hint={query ? "Try another search." : "Add a place, or change the filter."}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 1000, alignSelf: "center" },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
});
