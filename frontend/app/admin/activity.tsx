import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatDate } from "../../src/admin";
import { to } from "../../src/adminUi";
import { auditLink, auditSentence, timeAgo } from "../../src/adminUsers";
import { adminApi } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";
import type { AuditEntry } from "../../src/types";
import { Button, Chip, Empty, ErrorText } from "../../src/ui";

type Filter = "all" | "place" | "user" | "lead" | "report";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "place", label: "Places" },
  { value: "user", label: "Users" },
  { value: "report", label: "Reports" },
  { value: "lead", label: "Leads" },
];
const PAGE = 50;

/** Who did what in the admin section, newest first. Admins only. */
export default function Activity() {
  const params = useLocalSearchParams<{ actor?: string; type?: string; target?: string }>();
  const { user: me } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>((params.type as Filter) || "all");
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const actorId = params.actor ? Number(params.actor) : undefined;
  const targetId = params.target ? Number(params.target) : undefined;

  const query = useCallback(
    (before?: number) =>
      adminApi.audit({
        target_type: filter === "all" ? undefined : filter,
        target_id: targetId,
        actor_id: actorId,
        before_id: before,
        limit: PAGE,
      }),
    [filter, actorId, targetId]
  );

  const load = useCallback(async () => {
    setError("");
    try {
      const page = await query();
      setEntries(page.entries);
      setNext(page.next_before_id);
    } catch (e: any) {
      setError(e.message);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadMore = async () => {
    if (!next || loadingMore || !entries) return;
    setLoadingMore(true);
    try {
      const page = await query(next);
      setEntries([...entries, ...page.entries]);
      setNext(page.next_before_id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  if (me?.role !== "admin") return <Empty testID="activity-admin-only" icon="lock-outline" title="Admins only" />;

  return (
    <FlatList
      testID="admin-activity-list"
      data={entries ?? []}
      keyExtractor={(e) => String(e.id)}
      contentContainerStyle={styles.page}
      ListHeaderComponent={
        <View>
          <Text variant="headlineSmall">Activity log</Text>
          <Text style={{ color: colors.muted, marginBottom: spacing.md }}>
            Every change made in the admin section: who, what and when. Entries are never edited.
          </Text>
          {(actorId !== undefined || targetId !== undefined) && (
            <Button
              testID="activity-clear-person"
              title="Show everyone’s activity"
              variant="text"
              onPress={() => router.setParams({ actor: "", target: "" })}
            />
          )}
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f.value} testID={`activity-filter-${f.value}`} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </View>
          <ErrorText testID="activity-error">{error}</ErrorText>
          {!entries && !error && <ActivityIndicator color={colors.primary} />}
        </View>
      }
      renderItem={({ item }) => {
        const link = auditLink(item);
        return (
          <Pressable testID={`activity-${item.id}`} disabled={!link} onPress={() => link && router.push(to(link))} style={styles.row}>
            <Text>{auditSentence(item)}</Text>
            <Text variant="bodySmall" style={{ color: colors.muted }}>
              {timeAgo(item.created_at)} · {formatDate(item.created_at)}
            </Text>
          </Pressable>
        );
      }}
      ListFooterComponent={
        next ? (
          <Button testID="activity-more" title="Load older entries" variant="text" onPress={loadMore} loading={loadingMore} />
        ) : null
      }
      ListEmptyComponent={entries ? <Empty testID="activity-empty" icon="history" title="Nothing logged yet" /> : null}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 900, alignSelf: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
    marginBottom: spacing.xs + 2,
  },
});
