import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Href, useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { ActivityIndicator, Card, Text } from "react-native-paper";

import { colors, fontFamily, radius, spacing } from "../../src/theme";
import type { Yatra } from "../../src/types";
import { Button, Empty, PageHeader } from "../../src/ui";
import { useYatras } from "../../src/yatras";

export default function MyYatras() {
  const { yatras, ready } = useYatras();
  const router = useRouter();

  return (
    <FlatList
      testID="yatras-list"
      data={yatras}
      keyExtractor={(y) => y.id}
      contentContainerStyle={{ paddingBottom: spacing.xl }}
      ListHeaderComponent={
        <View style={{ marginBottom: spacing.md }}>
          <PageHeader
            title="My Yatras"
            subtitle="Your planned pilgrimages, stop by stop"
            right={<MaterialCommunityIcons name="bag-personal-outline" size={30} color="rgba(255,255,255,0.9)" />}
          />
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: spacing.md }}>
          <YatraCard yatra={item} onPress={() => router.push(`/yatra/${item.id}` as Href)} />
        </View>
      )}
      ListEmptyComponent={
        !ready ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <Empty
            icon="map-marker-path"
            title="No yatras yet"
            hint="Plan a route, then tap “Save as yatra” to keep it here with a checklist of stops."
            action={<Button testID="yatras-plan" title="Plan a route" icon="map-marker-path" onPress={() => router.push("/plan")} />}
          />
        )
      }
    />
  );
}

function YatraCard({ yatra, onPress }: { yatra: Yatra; onPress: () => void }) {
  const done = yatra.stops.filter((s) => s.visited).length;
  const total = yatra.stops.length;
  return (
    <View testID={`yatra-card-${yatra.id}`} style={{ marginBottom: spacing.sm + 4 }}>
      <Card mode="elevated" elevation={1} style={styles.card} onPress={onPress}>
        <Card.Content style={{ paddingBottom: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.icon}>
              <MaterialCommunityIcons name="map-marker-path" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={{ fontFamily: fontFamily.bold }} numberOfLines={1}>
                {yatra.name}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.muted }}>
                {yatra.total_km} km · {total} stop{total === 1 ? "" : "s"} · saved{" "}
                {new Date(yatra.created_at).toLocaleDateString()}
              </Text>
              {!!yatra.via?.length && (
                <Text testID={`yatra-card-via-${yatra.id}`} variant="bodySmall" style={{ color: colors.warnText }} numberOfLines={1}>
                  via {yatra.via.map((b) => b.label.split(",")[0]).join(", ")}
                </Text>
              )}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${total ? (done / total) * 100 : 0}%` }]} />
            </View>
            <Text variant="bodySmall" style={{ color: colors.muted, marginTop: 4 }}>
              {done} of {total} visited
            </Text>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: colors.card },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  progress: { height: 8, borderRadius: 4, backgroundColor: colors.surfaceVariant, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
