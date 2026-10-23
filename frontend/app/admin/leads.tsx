import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatDate, LEAD_STATUS_LABEL } from "../../src/admin";
import { AdminSection, FieldCell, FieldRow, to } from "../../src/adminUi";
import { adminApi } from "../../src/api";
import { colors, fontFamily, radius, spacing } from "../../src/theme";
import type { Lead, LeadStatus } from "../../src/types";
import { Button, Chip, Empty, ErrorText, Input, Pill } from "../../src/ui";

type Filter = LeadStatus | "open" | "all";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "To follow up" },
  { value: "to_call", label: LEAD_STATUS_LABEL.to_call },
  { value: "called", label: LEAD_STATUS_LABEL.called },
  { value: "drafted", label: LEAD_STATUS_LABEL.drafted },
  { value: "rejected", label: LEAD_STATUS_LABEL.rejected },
  { value: "all", label: "All" },
];
const TONE: Record<LeadStatus, "warn" | "primary" | "success" | "neutral"> = {
  to_call: "warn",
  called: "primary",
  drafted: "success",
  rejected: "neutral",
};

/** Places you heard of somewhere, to call or visit before they become draft places. */
export default function Leads() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setLeads(await adminApi.leads());
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const add = async () => {
    setError("");
    if (name.trim().length < 2) return setError("Enter the place name.");
    setSaving(true);
    try {
      await adminApi.addLead({
        name: name.trim(),
        area: area.trim() || undefined,
        source: source.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setName("");
      setArea("");
      setSource("");
      setNotes("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    setError("");
    try {
      await adminApi.updateLead(lead.id, { status });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const shown = (leads ?? []).filter((l) =>
    filter === "all" ? true : filter === "open" ? l.status === "to_call" || l.status === "called" : l.status === filter
  );

  return (
    <FlatList
      testID="admin-leads-list"
      data={shown}
      keyExtractor={(l) => String(l.id)}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          <Text variant="headlineSmall" style={{ marginBottom: spacing.xs }}>
            Leads to call
          </Text>
          <Text style={{ color: colors.muted, marginBottom: spacing.md }}>
            Use other lists only to learn a place exists. Call or visit, then make a draft and write the details yourself.
          </Text>

          <AdminSection title="Add a lead" testID="lead-add-form">
            <FieldRow>
              <FieldCell>
                <Input testID="lead-name" label="Place name" value={name} onChangeText={setName} />
              </FieldCell>
              <FieldCell>
                <Input testID="lead-area" label="Town / district" value={area} onChangeText={setArea} />
              </FieldCell>
            </FieldRow>
            <Input testID="lead-source" label="Where you heard of it" value={source} onChangeText={setSource} />
            <Input testID="lead-notes" label="Notes" value={notes} onChangeText={setNotes} multiline />
            <ErrorText testID="lead-error">{error}</ErrorText>
            <Button testID="lead-add" title="Add lead" icon="plus" variant="tonal" onPress={add} loading={saving} />
          </AdminSection>

          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f.value} testID={`lead-filter-${f.value}`} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </View>
          {!leads && !error && <ActivityIndicator color={colors.primary} />}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card} testID={`lead-${item.id}`}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 16 }}>{item.name}</Text>
              <Text variant="bodySmall" style={{ color: colors.muted }}>
                {[item.area, item.source && `via ${item.source}`, `added ${formatDate(item.created_at)}`].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Pill testID={`lead-status-${item.id}`} label={LEAD_STATUS_LABEL[item.status]} tone={TONE[item.status]} />
          </View>
          {!!item.notes && <Text style={{ marginTop: spacing.xs }}>{item.notes}</Text>}
          <View style={styles.actions}>
            {item.place_id ? (
              <Button
                testID={`lead-open-draft-${item.id}`}
                title="Open draft"
                icon="pencil-outline"
                variant="tonal"
                onPress={() => router.push(to(`/admin/place/${item.place_id}`))}
              />
            ) : (
              item.status !== "rejected" && (
                <Button
                  testID={`lead-make-draft-${item.id}`}
                  title="Make draft"
                  icon="map-marker-plus-outline"
                  variant="tonal"
                  onPress={() =>
                    router.push(
                      to(
                        `/admin/place/new?lead=${item.id}&name=${encodeURIComponent(item.name)}&area=${encodeURIComponent(item.area ?? "")}`
                      )
                    )
                  }
                />
              )
            )}
            {item.status === "to_call" && (
              <Button testID={`lead-called-${item.id}`} title="Mark called" variant="text" icon="phone-check-outline" onPress={() => setStatus(item, "called")} />
            )}
            {(item.status === "to_call" || item.status === "called") && (
              <Button testID={`lead-reject-${item.id}`} title="Reject" variant="text" icon="close" onPress={() => setStatus(item, "rejected")} />
            )}
            {item.status === "rejected" && (
              <Button testID={`lead-reopen-${item.id}`} title="Reopen" variant="text" icon="undo" onPress={() => setStatus(item, "to_call")} />
            )}
          </View>
        </View>
      )}
      ListEmptyComponent={leads ? <Empty testID="lead-empty" icon="phone-outline" title="No leads here" hint="Add one above." /> : null}
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
});
