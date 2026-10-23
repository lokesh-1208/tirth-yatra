import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatDate } from "../src/admin";
import { to } from "../src/adminUi";
import { api } from "../src/api";
import { REPORT_STATUS_LABEL, TOPIC_LABEL } from "../src/reports";
import { colors, fontFamily, radius, spacing } from "../src/theme";
import type { Report } from "../src/types";
import { Button, Empty, ErrorText, Pill } from "../src/ui";

/** The reports this pilgrim has sent, with what the team did about them. */
export default function MyReports() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      api
        .myReports()
        .then(setReports)
        .catch((e) => setError(e.message));
    }, [])
  );

  return (
    <FlatList
      testID="my-reports-list"
      data={reports ?? []}
      keyExtractor={(r) => String(r.id)}
      contentContainerStyle={styles.page}
      ListHeaderComponent={
        <View>
          <ErrorText testID="my-reports-error">{error}</ErrorText>
          {!reports && !error && <ActivityIndicator color={colors.primary} />}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card} testID={`my-report-${item.id}`}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamily.semibold }}>
                {item.kind === "new_place" ? `Missing place: ${item.place_title ?? ""}` : item.place_title ?? "A place"}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.muted }}>
                {item.kind === "correction" ? `${TOPIC_LABEL[item.topic]} · ` : ""}
                {formatDate(item.created_at)}
              </Text>
            </View>
            <Pill
              testID={`my-report-status-${item.id}`}
              label={REPORT_STATUS_LABEL[item.status]}
              tone={item.status === "open" ? "warn" : item.status === "resolved" ? "success" : "neutral"}
            />
          </View>
          <Text style={{ marginTop: spacing.xs }}>{item.message}</Text>
          {!!item.curator_note && (
            <View style={styles.note}>
              <Text variant="bodySmall" style={{ color: colors.secondary, fontFamily: fontFamily.bold }}>
                From the Tirth Yatra team
              </Text>
              <Text>{item.curator_note}</Text>
            </View>
          )}
        </View>
      )}
      ListEmptyComponent={
        reports ? (
          <Empty
            testID="my-reports-empty"
            icon="flag-outline"
            title="No reports yet"
            hint="Seen wrong timings or a missing mandir? Tell us from the place page or after planning a route."
            action={<Button title="Tell us about a missing place" variant="tonal" onPress={() => router.push(to("/report"))} />}
          />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 700, alignSelf: "center" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  note: { backgroundColor: colors.secondaryLight, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
});
