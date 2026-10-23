import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatDate, METHOD_LABEL, recheckLabel } from "../../src/admin";
import { AdminSection, CoverThumb, StatusPill, to } from "../../src/adminUi";
import { adminApi } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, fontFamily, radius, spacing } from "../../src/theme";
import type { AdminSummary } from "../../src/types";
import { Button, ErrorText } from "../../src/ui";

export default function AdminHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await adminApi.summary());
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  // Reload whenever the screen comes back into view (after editing a place, for example).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <Pressable testID="admin-back-to-app" onPress={() => router.replace(to("/profile"))} style={styles.back} accessibilityRole="link">
        <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontFamily: fontFamily.semibold, marginLeft: 4 }}>Back to the app</Text>
      </Pressable>

      <View style={styles.headRow}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text variant="headlineSmall" testID="admin-title">
            Namaste, {user?.name ?? "curator"}
          </Text>
          <Text style={{ color: colors.muted }}>
            {user?.role === "admin" ? "Admin: places, reports, leads, users and the activity log." : "Add places, log checks and make them live."}
          </Text>
        </View>
        <Button testID="admin-add-place" title="Add a place" icon="plus" onPress={() => router.push(to("/admin/place/new"))} />
      </View>

      <ErrorText testID="admin-error">{error}</ErrorText>
      {!data && !error && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />}

      {data && (
        <>
          <View style={styles.tiles}>
            <Tile testID="admin-tile-live" label="Live places" value={data.counts.live} onPress={() => router.push(to("/admin/places?status=live"))} />
            <Tile testID="admin-tile-draft" label="Drafts" value={data.counts.draft} onPress={() => router.push(to("/admin/places?status=draft"))} />
            <Tile
              testID="admin-tile-review"
              label="In review"
              value={data.counts.in_review}
              onPress={() => router.push(to("/admin/places?status=in_review"))}
            />
            <Tile
              testID="admin-tile-recheck"
              label="Re-check due"
              value={data.recheck_due}
              warn
              onPress={() => router.push(to("/admin/places?recheck=1"))}
            />
            <Tile testID="admin-tile-leads" label="Leads to follow up" value={data.open_leads} onPress={() => router.push(to("/admin/leads"))} />
            <Tile
              testID="admin-tile-reports"
              label="Reports to review"
              value={data.open_reports}
              warn={data.open_reports > 0}
              onPress={() => router.push(to("/admin/reviews"))}
            />
          </View>

          <View style={styles.columns}>
            <AdminSection
              title="Re-check due"
              hint="Live places never checked, or whose re-check date has come."
              style={styles.colWide}
              testID="admin-due-list"
            >
              {data.due_places.length === 0 ? (
                <Text style={{ color: colors.muted }}>Nothing due. Every live place is up to date.</Text>
              ) : (
                data.due_places.map((p) => (
                  <Pressable
                    key={p.id}
                    testID={`admin-due-${p.id}`}
                    style={styles.dueRow}
                    onPress={() => router.push(to(`/admin/place/${p.id}`))}
                  >
                    <View style={{ width: 56 }}>
                      <CoverThumb url={p.cover_url} name={p.name} kind={p.kind} sect={p.sect} height={40} compact />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={{ fontFamily: fontFamily.semibold }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: colors.muted }}>
                        {[p.city, p.district].filter(Boolean).join(", ") || "No town yet"}
                      </Text>
                    </View>
                    <Text variant="bodySmall" style={{ color: colors.warnText, fontFamily: fontFamily.semibold }}>
                      {recheckLabel(p.recheck_due)}
                    </Text>
                  </Pressable>
                ))
              )}
            </AdminSection>

            <AdminSection title="Recent checks" style={styles.colNarrow} testID="admin-recent-checks">
              {data.recent_checks.length === 0 ? (
                <Text style={{ color: colors.muted }}>No checks logged yet. Open a place and use “Log a check”.</Text>
              ) : (
                data.recent_checks.map((c, i) => (
                  <Pressable key={i} style={styles.checkRow} onPress={() => router.push(to(`/admin/place/${c.place_id}`))}>
                    <Text style={{ fontFamily: fontFamily.semibold }} numberOfLines={1}>
                      {c.place_name}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.muted }}>
                      {formatDate(c.checked_on)} · {METHOD_LABEL[c.method] ?? c.method}
                      {c.checked_by_name ? ` · ${c.checked_by_name}` : ""}
                    </Text>
                  </Pressable>
                ))
              )}
            </AdminSection>
          </View>

          <View style={styles.links}>
            <Button testID="admin-open-places" title="All places" icon="map-marker-multiple-outline" variant="outline" onPress={() => router.push(to("/admin/places"))} />
            <Button testID="admin-open-leads" title="Leads to call" icon="phone-outline" variant="outline" onPress={() => router.push(to("/admin/leads"))} />
            <Button testID="admin-open-reviews" title="Review queue" icon="flag-outline" variant="outline" onPress={() => router.push(to("/admin/reviews"))} />
            {user?.role === "admin" && (
              <>
                <Button testID="admin-open-users" title="Users" icon="account-group-outline" variant="outline" onPress={() => router.push(to("/admin/users"))} />
                <Button testID="admin-open-activity" title="Activity log" icon="history" variant="outline" onPress={() => router.push(to("/admin/activity"))} />
              </>
            )}
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            {(["draft", "in_review", "live", "hidden"] as const).map((s) => (
              <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <StatusPill status={s} />
                <Text variant="bodySmall" style={{ color: colors.muted }}>
                  {data.counts[s] ?? 0}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Tile({ label, value, onPress, warn, testID }: { label: string; value: number; onPress: () => void; warn?: boolean; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={[styles.tile, warn && { backgroundColor: colors.warnBg }]}>
      <Text variant="bodySmall" style={{ color: warn ? colors.warnText : colors.muted }}>
        {label}
      </Text>
      <Text variant="headlineMedium" style={{ fontFamily: fontFamily.bold, color: warn ? colors.warnText : colors.text }}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 1100, alignSelf: "center" },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44, alignSelf: "flex-start" },
  headRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  columns: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md },
  colWide: { flexGrow: 3, flexBasis: 420, minWidth: 0 },
  colNarrow: { flexGrow: 2, flexBasis: 280, minWidth: 0 },
  dueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    minHeight: 56,
  },
  checkRow: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  links: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
});
