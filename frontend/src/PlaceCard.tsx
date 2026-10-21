import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "./theme";
import type { Place, RoutePlace } from "./types";

const KIND_LABEL: Record<string, string> = {
  tirth: "Tirth",
  atishay_kshetra: "Atishay Kshetra",
  temple: "Temple",
  dharamshala: "Dharamshala",
};

export function PlaceCard({
  place,
  onToggleSave,
  showSave = true,
}: {
  place: Place | RoutePlace;
  onToggleSave?: (p: Place) => void;
  showSave?: boolean;
}) {
  const router = useRouter();
  const route = place as RoutePlace;
  return (
    <Pressable
      testID={`place-card-${place.id}`}
      onPress={() => router.push(`/place/${place.id}`)}
      style={styles.card}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{place.name}</Text>
        <Text style={styles.sub}>
          {[KIND_LABEL[place.kind] ?? place.kind, place.sect, place.city].filter(Boolean).join(" · ")}
        </Text>
        {route.detour_km !== undefined && (
          <Text style={styles.route}>
            {route.distance_from_start_km} km from start · {route.detour_km} km detour
          </Text>
        )}
        {!place.verified && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Not yet verified</Text>
          </View>
        )}
      </View>
      {showSave && onToggleSave && (
        <Pressable
          testID={`save-btn-${place.id}`}
          accessibilityLabel={place.is_saved ? "Remove from saved" : "Save place"}
          hitSlop={10}
          onPress={() => onToggleSave(place)}
        >
          <Ionicons
            name={place.is_saved ? "bookmark" : "bookmark-outline"}
            size={24}
            color={place.is_saved ? colors.primary : colors.muted}
          />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  sub: { color: colors.muted, marginTop: 2, textTransform: "capitalize" },
  route: { color: colors.primaryDark, marginTop: 6, fontWeight: "600", fontSize: 13 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.warnBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  badgeText: { color: colors.warnText, fontSize: 11, fontWeight: "600" },
});
