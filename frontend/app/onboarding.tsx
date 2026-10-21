import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";
import { Button, Chip, ErrorText, Input } from "../src/ui";

const FAITHS = ["jain", "hindu", "sikh", "muslim", "buddhist", "christian"];
const JAIN_SECTS = ["digambar", "shvetambar"];

// Shown once after the first OTP login, when the account has no name yet.
export default function Onboarding() {
  const { setUser, logout } = useAuth();
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.title}>Welcome 🙏</Text>
          <Text style={styles.subtitle}>Tell us a little about you so we show the right places first</Text>

          <ErrorText testID="onboarding-error">{error}</ErrorText>

          <Input testID="onboarding-name" label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />

          <Text style={styles.label}>Faith</Text>
          <View style={styles.chips}>
            {FAITHS.map((f) => (
              <Chip
                key={f}
                testID={`faith-${f}`}
                label={f[0].toUpperCase() + f.slice(1)}
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
                    label={s[0].toUpperCase() + s.slice(1)}
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  form: { width: "100%", maxWidth: 420, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "800", color: colors.primaryDark },
  subtitle: { color: colors.muted, marginBottom: spacing.lg, marginTop: 4 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
  logout: { textAlign: "center", color: colors.muted, marginTop: spacing.lg },
});
