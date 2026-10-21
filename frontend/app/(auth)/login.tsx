import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../../src/auth";
import { colors, spacing } from "../../src/theme";
import { Button, ErrorText, Input } from "../../src/ui";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Text style={styles.logo}>🛕</Text>
          <Text style={styles.title}>Tirth Yatra</Text>
          <Text style={styles.subtitle}>Discover holy places along your journey</Text>

          <ErrorText testID="login-error">{error}</ErrorText>

          <Input
            testID="login-email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Input
            testID="login-password"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Your password"
            onSubmitEditing={submit}
          />
          <Button testID="login-submit" title="Log in" onPress={submit} loading={loading} />

          <View style={styles.footer}>
            <Text style={{ color: colors.muted }}>New here? </Text>
            <Link testID="go-register" href="/register" style={{ color: colors.primary, fontWeight: "700" }}>
              Create an account
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
  logo: { fontSize: 48, textAlign: "center" },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center", color: colors.primaryDark },
  subtitle: { textAlign: "center", color: colors.muted, marginBottom: spacing.lg, marginTop: 4 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
});
