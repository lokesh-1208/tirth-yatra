import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { Href } from "expo-router";
import { ReactNode } from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text } from "react-native-paper";

import { STATUS_LABEL } from "./admin";
import { assetUrl } from "./api";
import { AutoCover } from "./AutoCover";
import { colors, fontFamily, radius, spacing } from "./theme";
import type { PlaceStatus } from "./types";
import { Chip, Pill } from "./ui";

/** Route string for router.push: admin routes are new, so Expo's generated route types may lag behind. */
export const to = (path: string) => path as Href;

/** White card with a title, used for each part of the admin screens. */
export function AdminSection({
  title,
  hint,
  right,
  children,
  testID,
  style,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View testID={testID} style={[styles.section, style]}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ fontFamily: fontFamily.bold }}>
            {title}
          </Text>
          {!!hint && (
            <Text variant="bodySmall" style={{ color: colors.muted, marginTop: 2 }}>
              {hint}
            </Text>
          )}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Lays children out side by side on wide screens and stacked on phones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}
export function FieldCell({ children, min = 220 }: { children: ReactNode; min?: number }) {
  return <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: min, minWidth: Math.min(min, 260) }}>{children}</View>;
}

const STATUS_TONE: Record<PlaceStatus, "neutral" | "warn" | "success" | "primary"> = {
  draft: "neutral",
  in_review: "warn",
  live: "success",
  hidden: "primary",
};

export function StatusPill({ status, testID }: { status: PlaceStatus; testID?: string }) {
  return <Pill testID={testID} label={STATUS_LABEL[status] ?? status} tone={STATUS_TONE[status] ?? "neutral"} />;
}

/** A row of chips where exactly one option is chosen. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string }[];
  value: T | "" | null;
  onChange: (v: T) => void;
  testIDPrefix: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Chip key={o.value} testID={`${testIDPrefix}-${o.value}`} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text variant="labelLarge" style={{ color: colors.text, marginBottom: spacing.sm }}>
      {children}
    </Text>
  );
}

export function Note({ children, icon = "information-outline" }: { children: ReactNode; icon?: string }) {
  return (
    <View style={styles.note}>
      <MaterialCommunityIcons name={icon as any} size={16} color={colors.muted} style={{ marginTop: 2 }} />
      <Text variant="bodySmall" style={{ color: colors.muted, flex: 1, marginLeft: spacing.sm }}>
        {children}
      </Text>
    </View>
  );
}

/** Cover photo if there is one, else the auto cover. */
export function CoverThumb({
  url,
  name,
  kind,
  city,
  sect,
  height,
  compact,
  testID,
}: {
  url: string | null;
  name: string;
  kind: string;
  city?: string | null;
  sect?: string | null;
  height: number;
  compact?: boolean;
  testID?: string;
}) {
  const uri = assetUrl(url);
  if (uri)
    return (
      <Image
        testID={testID ?? "cover-photo"}
        source={{ uri }}
        accessibilityLabel={`Cover photo of ${name}`}
        style={{ width: "100%", height, borderRadius: compact ? radius.sm : radius.lg, backgroundColor: colors.surfaceVariant }}
      />
    );
  return <AutoCover name={name} kind={kind} city={city} sect={sect} height={height} compact={compact} testID={testID} />;
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md, gap: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
  note: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
});
