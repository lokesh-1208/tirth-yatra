import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { colors, spacing } from "./theme";

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
  testID,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "outline" | "danger";
  testID?: string;
  disabled?: boolean;
}) {
  const isOutline = variant === "outline";
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && { backgroundColor: colors.primary },
        variant === "danger" && { backgroundColor: colors.danger },
        isOutline && { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary },
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : "#fff"} />
      ) : (
        <Text style={[styles.btnText, isOutline && { color: colors.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Input({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        style={[styles.input, !!error && { borderColor: colors.danger }]}
        {...props}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: "#fff" }]}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ children, testID }: { children?: ReactNode; testID?: string }) {
  if (!children) return null;
  return (
    <Text testID={testID} style={styles.errorBanner}>
      {children}
    </Text>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ alignItems: "center", padding: spacing.xl }}>
      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{title}</Text>
      {!!hint && <Text style={{ color: colors.muted, marginTop: spacing.sm, textAlign: "center" }}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 48 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  errorBanner: {
    color: colors.danger,
    backgroundColor: "#FEE2E2",
    padding: spacing.sm + 2,
    borderRadius: 8,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    marginRight: spacing.sm,
  },
  chipText: { color: colors.text, fontWeight: "500" },
});
