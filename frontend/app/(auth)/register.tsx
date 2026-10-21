import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../src/auth";
import { colors, spacing } from "../../src/theme";
import { Button, Chip, ErrorText, Input } from "../../src/ui";

const FAITHS = ["jain", "hindu", "sikh", "muslim", "buddhist", "christian"];
const JAIN_SECTS = ["digambar", "shvetambar"];

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [faith, setFaith] = useState<string | undefined>("jain");
  const [sect, setSect] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Please enter a valid email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await register({ name: name.trim(), email, password, faith, sect: faith === "jain" ? sect : undefined });
    } catch (e: any) {
      setError(e.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Tell us your faith so we show the right places first</Text>

          <ErrorText testID="register-error">{error}</ErrorText>

          <Input testID="register-name" label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input
            testID="register-email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            testID="register-password"
            label="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

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
          <Button testID="register-submit" title="Sign up" onPress={submit} loading={loading} />

          <View style={styles.footer}>
            <Text style={{ color: colors.muted }}>Already have an account? </Text>
            <Link testID="go-login" href="/login" style={{ color: colors.primary, fontWeight: "700" }}>
              Log in
            </Link>
          </View>
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
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
});
