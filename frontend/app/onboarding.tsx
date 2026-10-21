import { useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { capitalize, colors, radius, spacing } from "../src/theme";
import { Button, Chip, ErrorText, Hero, Input } from "../src/ui";

const FAITHS = ["jain", "hindu", "sikh", "muslim", "buddhist", "christian"];
const JAIN_SECTS = ["digambar", "shvetambar"];

// Shown once after the first OTP login, when the account has no name yet.
export default function Onboarding() {
  const { setUser, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [faith, setFaith] = useState<string | undefined>("jain");
  const [sect, setSect] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    setLoading(true);
    try {
      setUser(await api.updateMe({ name: name.trim(), faith, sect: faith === "jain" ? sect : undefined }));
    } catch (e: any) {
      setError(e.message ?? "Could not save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Hero style={{ paddingTop: insets.top + spacing.xl, paddingBottom: 72, alignItems: "center" }}>
          <MaterialCommunityIcons name="hands-pray" size={44} color="#fff" />
          <Text variant="headlineLarge" style={styles.title}>
            Welcome
          </Text>
          <Text style={styles.subtitle}>Tell us a little about you so we show the right places first</Text>
        </Hero>
        <Card mode="elevated" elevation={2} style={styles.form}>
          <Card.Content>

          <ErrorText testID="onboarding-error">{error}</ErrorText>

          <Input testID="onboarding-name" label="Your name" value={name} onChangeText={setName} autoCapitalize="words" left="account-outline" />

          <Text style={styles.label}>Faith</Text>
          <View style={styles.chips}>
            {FAITHS.map((f) => (
              <Chip
                key={f}
                testID={`faith-${f}`}
                label={capitalize(f)}
                selected={faith === f}
                onPress={() => {
                  setFaith(f);
                  if (f !== "jain") setSect(undefined);
                }}
              />
            ))}
          </View>

          {faith === "jain" && (
            <>
              <Text style={styles.label}>Sect (optional)</Text>
              <View style={styles.chips}>
                {JAIN_SECTS.map((s) => (
                  <Chip
                    key={s}
                    testID={`sect-${s}`}
                    label={capitalize(s)}
                    selected={sect === s}
                    onPress={() => setSect(sect === s ? undefined : s)}
                  />
                ))}
              </View>
            </>
          )}

          <View style={{ height: spacing.md }} />
          <Button testID="onboarding-submit" title="Continue" onPress={submit} loading={loading} />
          <Text testID="onboarding-logout" onPress={logout} style={styles.logout}>
            Use a different account
          </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "92%",
    maxWidth: 440,
    alignSelf: "center",
    marginTop: -48,
    marginBottom: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
  },
  title: { color: "#fff", marginTop: spacing.sm },
  subtitle: { color: "rgba(255,255,255,0.9)", marginTop: 4, textAlign: "center", fontSize: 15 },
  label: { color: colors.text, marginBottom: 8, fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
  logout: { textAlign: "center", color: colors.muted, marginTop: spacing.lg },
});
