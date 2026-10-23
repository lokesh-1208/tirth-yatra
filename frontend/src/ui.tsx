import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button as PaperButton,
  Chip as PaperChip,
  Text,
  TextInput,
  TextInputProps,
} from "react-native-paper";

import { colors, fontFamily, heroGradient, radius, spacing } from "./theme";

/**
 * Shared building blocks. Screens use these instead of raw Paper components so the look stays
 * consistent and every interactive element keeps a stable testID for the Playwright suite.
 */

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
  testID,
  disabled,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "outline" | "danger" | "tonal" | "text";
  testID?: string;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const mode =
    variant === "outline" ? "outlined" : variant === "tonal" ? "contained-tonal" : variant === "text" ? "text" : "contained";
  return (
    <PaperButton
      testID={testID}
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={loading || disabled}
      icon={icon}
      buttonColor={variant === "danger" ? colors.danger : undefined}
      style={[styles.btn, variant === "outline" && { borderColor: colors.primary, borderWidth: 1.5 }, style]}
      contentStyle={styles.btnContent}
      labelStyle={styles.btnLabel}
    >
      {title}
    </PaperButton>
  );
}

export function Input({
  label,
  error,
  left,
  ...props
}: Omit<TextInputProps, "error" | "label" | "left"> & { label: string; error?: string; left?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <TextInput
        mode="outlined"
        label={label}
        autoCapitalize="none"
        error={!!error}
        outlineStyle={{ borderRadius: radius.md }}
        style={{ backgroundColor: colors.card }}
        left={left ? <TextInput.Icon icon={left} color={colors.muted} /> : undefined}
        {...props}
      />
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  icon?: string;
}) {
  return (
    <PaperChip
      testID={testID}
      mode={selected ? "flat" : "outlined"}
      selected={selected}
      showSelectedCheck={false}
      icon={
        icon
          ? ({ size }: { size: number }) => (
              <MaterialCommunityIcons name={icon as IconName} size={size} color={selected ? "#fff" : colors.primary} />
            )
          : undefined
      }
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
      textStyle={[styles.chipText, selected && { color: "#fff" }]}
      selectedColor={selected ? "#fff" : colors.text}
    >
      {label}
    </PaperChip>
  );
}

export function ErrorText({ children, testID }: { children?: ReactNode; testID?: string }) {
  if (!children) return null;
  return (
    <View style={styles.errorBanner}>
      <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
      <Text testID={testID} style={styles.errorText}>
        {children}
      </Text>
    </View>
  );
}

export function SuccessText({ children, testID }: { children?: ReactNode; testID?: string }) {
  if (!children) return null;
  return (
    <View style={[styles.errorBanner, { backgroundColor: colors.successLight }]}>
      <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.success} />
      <Text testID={testID} style={[styles.errorText, { color: colors.success }]}>
        {children}
      </Text>
    </View>
  );
}

export function Empty({
  title,
  hint,
  icon = "map-search-outline",
  action,
  testID,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  action?: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={36} color={colors.primary} />
      </View>
      <Text variant="titleMedium" style={{ textAlign: "center" }}>
        {title}
      </Text>
      {!!hint && (
        <Text variant="bodyMedium" style={{ color: colors.muted, marginTop: spacing.xs, textAlign: "center" }}>
          {hint}
        </Text>
      )}
      {action && <View style={{ marginTop: spacing.md }}>{action}</View>}
    </View>
  );
}

/** Shown wherever real, verified data hasn't been added yet. */
export function Placeholder({ text = "Not added yet. We'll add verified details soon." }: { text?: string }) {
  return (
    <View style={styles.placeholder}>
      <MaterialCommunityIcons name="progress-clock" size={18} color={colors.gold} />
      <Text variant="bodyMedium" style={{ color: colors.warnText, marginLeft: spacing.sm, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="titleMedium" style={{ fontFamily: fontFamily.bold }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

/** Saffron gradient header used at the top of the main screens. */
export function Hero({
  children,
  style,
  minHeight,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  minHeight?: number;
}) {
  return (
    <LinearGradient
      colors={heroGradient as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, minHeight ? { minHeight } : null, style]}
    >
      {/* soft decorative circles */}
      <View style={[styles.halo, { width: 220, height: 220, top: -80, right: -60 }]} />
      <View style={[styles.halo, { width: 140, height: 140, bottom: -50, left: -40 }]} />
      {children}
    </LinearGradient>
  );
}

/** Hero header for tab screens: big serif title, subtitle, optional action on the right. */
export function PageHeader({
  title,
  subtitle,
  right,
  children,
  testID,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Hero style={{ paddingTop: insets.top + spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text testID={testID} variant="headlineMedium" style={styles.heroTitle}>
            {title}
          </Text>
          {!!subtitle && <Text style={styles.heroSub}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </Hero>
  );
}

/** Small pill used for "Verified", "Sample data", km counts and so on. */
export function Pill({
  label,
  icon,
  tone = "neutral",
  testID,
}: {
  label: string;
  icon?: IconName;
  tone?: "neutral" | "warn" | "success" | "primary" | "onDark";
  testID?: string;
}) {
  const t = {
    neutral: { bg: colors.surfaceVariant, fg: colors.text },
    warn: { bg: colors.warnBg, fg: colors.warnText },
    success: { bg: colors.successLight, fg: colors.success },
    primary: { bg: colors.primaryLight, fg: colors.primaryDark },
    onDark: { bg: "rgba(255,255,255,0.2)", fg: "#fff" },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      {icon && <MaterialCommunityIcons name={icon} size={14} color={t.fg} style={{ marginRight: 4 }} />}
      <Text testID={testID} style={[styles.pillText, { color: t.fg }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.md },
  btnContent: { minHeight: 50 },
  btnLabel: { fontSize: 16, fontFamily: fontFamily.bold, letterSpacing: 0.2 },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 4 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.dangerLight,
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.danger, marginLeft: spacing.sm, flex: 1 },
  chip: { marginRight: spacing.sm, borderRadius: 20, borderColor: colors.border, backgroundColor: colors.card },
  chipText: { fontFamily: fontFamily.medium, color: colors.text },
  empty: { alignItems: "center", padding: spacing.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  placeholder: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.goldLight,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  hero: { padding: spacing.lg, overflow: "hidden", borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl },
  heroTitle: { color: "#fff", lineHeight: 40 },
  heroSub: { color: "rgba(255,255,255,0.88)", fontSize: 15, marginTop: 2 },
  halo: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, fontFamily: fontFamily.semibold },
});
