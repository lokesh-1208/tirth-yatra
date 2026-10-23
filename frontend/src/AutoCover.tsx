import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

import { colors, fontFamily, KIND_ICON, KIND_LABEL, radius } from "./theme";

/** Colour band at the bottom of the auto cover, so sect is clear at a glance. */
const SECT_BAND: Record<string, string[]> = {
  digambar: [colors.secondary],
  shvetambar: [colors.gold],
  all: [colors.secondary, colors.gold],
};

type Props = {
  name: string;
  kind: string;
  city?: string | null;
  sect?: string | null;
  height?: number;
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cover shown when a place has no cover photo yet: name, kind and town on a saffron card.
 * Never shows a deity image, by design.
 */
export function AutoCover({ name, kind, city, sect, height = 180, compact, testID = "auto-cover", style }: Props) {
  const band = SECT_BAND[sect ?? ""] ?? [colors.primaryDark];
  const line = [KIND_LABEL[kind] ?? kind, city].filter(Boolean).join(" · ").toUpperCase();
  return (
    <View
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={`Cover for ${name}`}
      style={[styles.card, { height, borderRadius: compact ? radius.sm : radius.lg }, style]}
    >
      <MaterialCommunityIcons
        name={(KIND_ICON[kind] ?? "flag-variant") as any}
        size={compact ? height * 0.9 : height * 0.75}
        color="rgba(255,255,255,0.10)"
        style={styles.watermark}
      />
      <Text
        numberOfLines={2}
        style={[styles.name, { fontSize: compact ? 13 : 24, lineHeight: compact ? 16 : 30 }]}
      >
        {name}
      </Text>
      {!compact && !!line && <Text style={styles.line}>{line}</Text>}
      <View style={styles.band}>
        {band.map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c }} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.primaryDark,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  watermark: { position: "absolute", right: -10, bottom: -10 },
  name: { color: "#fff", fontFamily: fontFamily.display, textAlign: "center" },
  line: { color: colors.goldLight, fontFamily: fontFamily.semibold, fontSize: 12, letterSpacing: 1, marginTop: 6 },
  band: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, flexDirection: "row" },
});
