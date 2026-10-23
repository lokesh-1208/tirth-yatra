import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, StyleSheet, View } from "react-native";
import { Card, IconButton, Text } from "react-native-paper";

import { assetUrl } from "./api";
import { capitalize, colors, fontFamily, KIND_ICON, KIND_LABEL, radius, spacing } from "./theme";
import type { Place, RoutePlace } from "./types";
import { Pill } from "./ui";

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
  const meta = [KIND_LABEL[place.kind] ?? place.kind, place.sect && place.sect !== "all" ? capitalize(place.sect) : null, place.city]
    .filter(Boolean)
    .join(" · ");

  return (
    // The testID lives on a plain wrapper: Paper adds "-container" testIDs to its own views,
    // which would otherwise also match the suite's [data-testid^="place-card-"] selector.
    <View testID={`place-card-${place.id}`} style={{ marginBottom: spacing.sm + 4 }}>
      <Card mode="elevated" elevation={1} style={styles.card} onPress={() => router.push(`/place/${place.id}`)}>
        <View style={styles.row}>
          <View style={{ flex: 1, padding: spacing.md, paddingRight: 0 }}>
            <Text testID="place-name" variant="titleMedium" style={styles.title} numberOfLines={2}>
              {place.name}
            </Text>
            <Text variant="bodySmall" style={styles.sub} numberOfLines={1}>
              {meta}
            </Text>
            {route.detour_km !== undefined && (
              <View style={styles.routeRow}>
                <MaterialCommunityIcons name="map-marker-distance" size={14} color={colors.primaryDark} />
                <Text style={styles.route}>
                  {route.distance_from_start_km} km from start · {route.detour_km} km detour
                </Text>
              </View>
            )}
            {!place.verified && (
              <View style={{ marginTop: spacing.sm }}>
                <Pill label="Not yet verified" tone="warn" icon="progress-clock" />
              </View>
            )}
          </View>
          <Thumb place={place} />
        </View>
        {showSave && onToggleSave && (
          <IconButton
            testID={`save-btn-${place.id}`}
            accessibilityLabel={place.is_saved ? "Remove from saved" : "Save place"}
            icon={place.is_saved ? "bookmark" : "bookmark-outline"}
            iconColor={place.is_saved ? colors.primary : colors.muted}
            containerColor="rgba(255,255,255,0.95)"
            size={20}
            style={styles.save}
            onPress={() => onToggleSave(place)}
          />
        )}
      </Card>
    </View>
  );
}

/** Photo if we have one, otherwise a soft gradient tile with the place-kind icon. */
function Thumb({ place }: { place: Place }) {
  const uri = assetUrl(place.photo_url);
  if (uri) return <Image source={{ uri }} style={styles.thumb} />;
  return (
    <LinearGradient colors={[colors.primaryLight, colors.goldLight]} style={[styles.thumb, styles.thumbFallback]}>
      <MaterialCommunityIcons name={(KIND_ICON[place.kind] ?? "map-marker") as any} size={34} color={colors.primary} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "stretch" },
  title: { fontFamily: fontFamily.bold, color: colors.text, lineHeight: 22 },
  sub: { color: colors.muted, marginTop: 2 },
  routeRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  route: { color: colors.primaryDark, fontFamily: fontFamily.semibold, fontSize: 13, marginLeft: 4 },
  thumb: { width: 104, minHeight: 104, margin: spacing.sm, borderRadius: radius.md },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  save: { position: "absolute", top: 4, right: 4, margin: 6 },
});
