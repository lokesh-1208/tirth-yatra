import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, spacing } from "../../src/theme";
import { Button, ErrorText, Input } from "../../src/ui";

const RESEND_SECONDS = 30;

export default function Login() {
  const { verifyOtp } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null); // normalized identifier once OTP requested
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async () => {
    setError("");
    if (!identifier.trim()) return setError("Enter your email or mobile number.");
    setLoading(true);
    try {
      const res = await api.requestOtp(identifier.trim());
      setSentTo(res.identifier);
      setOtp("");
      setCooldown(RESEND_SECONDS);
    } catch (e: any) {
      setError(e.message ?? "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setError("");
    if (otp.trim().length < 4) return setError("Enter the OTP you received.");
    setLoading(true);
    try {
      await verifyOtp(sentTo!, otp);
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

          {!sentTo ? (
            <>
              <Input
                testID="login-identifier"
                label="Email or mobile number"
                value={identifier}
                onChangeText={setIdentifier}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="you@example.com or 98XXXXXXXX"
                onSubmitEditing={sendOtp}
              />
              <Button testID="login-send-otp" title="Send OTP" onPress={sendOtp} loading={loading} />
              <Text style={styles.hint}>New here? Just enter your email or number — we'll create your account.</Text>
            </>
          ) : (
            <>
              <Text style={styles.sentTo} testID="login-sent-to">
                OTP sent to {sentTo}
              </Text>
              <Input
                testID="login-otp"
                label="Enter OTP"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={6}
                onSubmitEditing={confirm}
              />
              <Button testID="login-verify" title="Verify & log in" onPress={confirm} loading={loading} />
              <View style={styles.row}>
                <Pressable
                  testID="login-change"
                  onPress={() => {
                    setSentTo(null);
                    setError("");
                  }}
                >
                  <Text style={styles.link}>Change</Text>
                </Pressable>
                <Pressable testID="login-resend" disabled={cooldown > 0 || loading} onPress={sendOtp}>
                  <Text style={[styles.link, cooldown > 0 && { color: colors.muted }]}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
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
  hint: { textAlign: "center", color: colors.muted, marginTop: spacing.md, fontSize: 13 },
  sentTo: { color: colors.text, marginBottom: spacing.md, fontWeight: "600" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  link: { color: colors.primary, fontWeight: "700" },
});
