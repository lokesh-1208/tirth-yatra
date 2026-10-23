import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatDate } from "../../src/admin";
import { StatusPill, to } from "../../src/adminUi";
import { adminApi } from "../../src/api";
import { QUEUE_STATUS_LABEL, TOPIC_LABEL } from "../../src/reports";
import { colors, fontFamily, radius, spacing } from "../../src/theme";
import type { AdminReport, ReportStatus } from "../../src/types";
import { Button, Chip, Empty, ErrorText, Input, Pill } from "../../src/ui";

type Filter = ReportStatus | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: QUEUE_STATUS_LABEL.open },
  { value: "resolved", label: QUEUE_STATUS_LABEL.resolved },
  { value: "dismissed", label: QUEUE_STATUS_LABEL.dismissed },
  { value: "all", label: "All" },
];

/** Pilgrim reports waiting for a curator. Fix the place in its editor, then mark the report resolved. */
export default function Reviews() {
  const params = useLocalSearchParams<{ place?: string }>();
  const placeId = params.place ? Number(params.place) : undefined;
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setReports(await adminApi.reports({ status: filter, place_id: placeId }));
    } catch (e: any) {
      setError(e.message);
    }
  }, [filter, placeId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <FlatList
      testID="admin-reviews-list"
      data={reports ?? []}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <Text variant="headlineSmall">Review queue</Text>
          <Text style={{ color: colors.muted, marginBottom: spacing.md }}>
            Check each report by call or visit. Fix the place in its editor, then mark the report resolved. Your note is
            shown to the pilgrim.
          </Text>
          {placeId !== undefined && (
            <Button testID="reviews-all-places" title="Show reports for all places" variant="text" onPress={() => router.setParams({ place: "" })} />
          )}
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f.value} testID={`reviews-filter-${f.value}`} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </View>
          <ErrorText testID="reviews-error">{error}</ErrorText>
          {!reports && !error && <ActivityIndicator color={colors.primary} />}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card} testID={`review-${item.id}`}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
            <Pill label={item.kind === "new_place" ? "Missing place" : TOPIC_LABEL[item.topic]} tone={item.kind === "new_place" ? "success" : "primary"} />
            {item.status !== "open" && <Pill testID={`review-status-${item.id}`} label={QUEUE_STATUS_LABEL[item.status]} tone="neutral" />}
            {item.place_status && <StatusPill status={item.place_status} />}
            <Text variant="bodySmall" style={{ color: colors.muted }}>
              #{item.id} · {formatDate(item.created_at)}
            </Text>
          </View>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: 16, marginTop: spacing.sm }}>
            {item.place_title ?? "Unknown place"}
            {item.area ? ` · ${item.area}` : ""}
          </Text>
          <Text style={{ marginTop: spacing.xs }}>{item.message}</Text>
          <Text variant="bodySmall" style={{ color: colors.muted, marginTop: spacing.xs }}>
            From {item.reporter_name ?? "a pilgrim"}
            {item.reporter_contact ? ` (${item.reporter_contact})` : ""}
          </Text>
          {!!item.curator_note && item.status !== "open" && (
            <Text variant="bodySmall" style={{ color: colors.secondary, marginTop: spacing.xs }}>
              Your note: {item.curator_note}
            </Text>
          )}

          {item.status === "open" ? (
            <>
              <Input
                testID={`review-note-${item.id}`}
                label="Note for the pilgrim (optional)"
                value={notes[item.id] ?? ""}
                onChangeText={(t) => setNotes((n) => ({ ...n, [item.id]: t }))}
              />
              <View style={styles.actions}>
                {item.place_id && (
                  <Button
                    testID={`review-open-place-${item.id}`}
                    title="Open place in editor"
                    icon="pencil-outline"
                    variant="tonal"
                    onPress={() => router.push(to(`/admin/place/${item.place_id}`))}
                  />
                )}
                {item.kind === "new_place" && (
                  <Button
                    testID={`review-to-lead-${item.id}`}
                    title="Add to leads"
                    icon="phone-plus-outline"
                    variant="tonal"
                    onPress={() => act(() => adminApi.reportToLead(item.id))}
                  />
                )}
                <Button
                  testID={`review-resolve-${item.id}`}
                  title="Mark resolved"
                  icon="check"
                  variant="outline"
                  onPress={() => act(() => adminApi.reviewReport(item.id, { status: "resolved", curator_note: notes[item.id] }))}
                />
                <Button
                  testID={`review-dismiss-${item.id}`}
                  title="Dismiss"
                  variant="text"
                  onPress={() => act(() => adminApi.reviewReport(item.id, { status: "dismissed", curator_note: notes[item.id] }))}
                />
              </View>
            </>
          ) : (
            <View style={styles.actions}>
              {item.lead_id && (
                <Button testID={`review-open-lead-${item.id}`} title="Open leads" variant="text" onPress={() => router.push(to("/admin/leads"))} />
              )}
              <Button
                testID={`review-reopen-${item.id}`}
                title="Reopen"
                icon="undo"
                variant="text"
                onPress={() => act(() => adminApi.reviewReport(item.id, { status: "open" }))}
              />
            </View>
          )}
        </View>
      )}
      ListEmptyComponent={
        reports ? <Empty testID="reviews-empty" icon="check-all" title={filter === "open" ? "No reports waiting" : "Nothing here"} /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 900, alignSelf: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
});
