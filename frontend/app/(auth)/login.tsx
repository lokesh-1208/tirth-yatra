import { useEffect, useState } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, fontFamily, radius, spacing } from "../../src/theme";
import { Button, ErrorText, Hero, Input } from "../../src/ui";

const RESEND_SECONDS = 30;

export default function Login() {
  const { verifyOtp } = useAuth();
  const insets = useSafeAreaInsets();
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
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Hero style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="hands-pray" size={40} color="#fff" />
          </View>
          <Text variant="displaySmall" style={styles.title}>
            Tirth Yatra
          </Text>
          <Text style={styles.subtitle}>Discover holy places along your journey</Text>
        </Hero>
        <Card mode="elevated" elevation={2} style={styles.form}>
          <Card.Content>
          <Text variant="titleLarge" style={{ marginBottom: spacing.md }}>
            {sentTo ? "Verify it's you" : "Login or sign up"}
          </Text>

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
                left="account-outline"
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
                left="lock-outline"
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
          </Card.Content>
        </Card>
        <Text style={styles.footer}>🙏 Jai Jinendra</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingBottom: 72 },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  form: {
    width: "92%",
    maxWidth: 440,
    alignSelf: "center",
    marginTop: -48,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    paddingVertical: spacing.sm,
  },
  title: { textAlign: "center", color: "#fff" },
  subtitle: { textAlign: "center", color: "rgba(255,255,255,0.9)", marginTop: 4, fontSize: 16 },
  hint: { textAlign: "center", color: colors.muted, marginTop: spacing.md, fontSize: 13 },
  sentTo: { color: colors.text, marginBottom: spacing.md, fontFamily: fontFamily.semibold },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg },
  link: { color: colors.primary, fontFamily: fontFamily.bold },
  footer: { textAlign: "center", color: colors.muted, marginVertical: spacing.lg },
});
