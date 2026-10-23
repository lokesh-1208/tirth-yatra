import { Href, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import { Avatar, Card, Divider, List, Switch, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { capitalize, colors, fontFamily, radius, spacing } from "../../src/theme";
import { Button, Chip, ErrorText, Hero, Pill, SectionHeader, SuccessText } from "../../src/ui";
import { useYatras } from "../../src/yatras";

const FAITHS = ["jain", "hindu", "sikh", "muslim", "buddhist", "christian"];
const JAIN_SECTS = ["digambar", "shvetambar"];
const LANGUAGE_NAMES: Record<string, string> = { en: "English", hi: "हिन्दी (Hindi)" };

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const { yatras } = useYatras();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [faith, setFaith] = useState<string | null>(user?.faith ?? null);
  const [sect, setSect] = useState<string | null>(user?.sect ?? null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState(false); // TODO(feature): wire to push notifications

  if (!user) return null;
  const dirty = faith !== user.faith || sect !== user.sect;
  const initials = (user.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const visited = yatras.reduce((n, y) => n + y.stops.filter((s) => s.visited).length, 0);

  const save = async () => {
    setError("");
    setMsg("");
    setSaving(true);
    try {
      const updated = await api.updateMe({ faith: faith ?? undefined, sect: faith === "jain" ? sect ?? undefined : undefined });
      setUser(updated);
      setMsg("Preferences saved");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <Hero style={{ paddingTop: insets.top + spacing.lg, alignItems: "center" }}>
        <Avatar.Text size={76} label={initials} style={styles.avatar} labelStyle={{ fontFamily: fontFamily.bold }} color={colors.primary} />
        <Text testID="profile-name" variant="headlineSmall" style={{ color: "#fff", marginTop: spacing.sm }}>
          {user.name}
        </Text>
        <Text testID="profile-email" style={{ color: "rgba(255,255,255,0.88)" }}>
          {user.email ?? user.phone}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          {user.faith && <Pill tone="onDark" icon="hands-pray" label={capitalize(user.faith)} />}
          {user.sect && <Pill tone="onDark" label={capitalize(user.sect)} />}
        </View>
      </Hero>

      <View style={{ paddingHorizontal: spacing.md }}>
        <View style={styles.stats}>
          <Stat value={yatras.length} label="Yatras" />
          <View style={styles.statDivider} />
          <Stat value={visited} label="Tirths visited" />
        </View>

        <SectionHeader title="Preferences" />
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            <Text variant="labelLarge" style={styles.heading}>
              My faith
            </Text>
            <View style={styles.chips}>
              {FAITHS.map((f) => (
                <Chip
                  key={f}
                  testID={`profile-faith-${f}`}
                  label={capitalize(f)}
                  selected={faith === f}
                  onPress={() => {
                    setFaith(f);
                    if (f !== "jain") setSect(null);
                  }}
                />
              ))}
            </View>

            {faith === "jain" && (
              <>
                <Text variant="labelLarge" style={styles.heading}>
                  Sect
                </Text>
                <View style={styles.chips}>
                  {JAIN_SECTS.map((s) => (
                    <Chip
                      key={s}
                      testID={`profile-sect-${s}`}
                      label={capitalize(s)}
                      selected={sect === s}
                      onPress={() => setSect(sect === s ? null : s)}
                    />
                  ))}
                </View>
              </>
            )}

            <ErrorText testID="profile-error">{error}</ErrorText>
            <SuccessText testID="profile-msg">{msg}</SuccessText>
            <Button testID="profile-save" title="Save preferences" onPress={save} loading={saving} disabled={!dirty} />
          </Card.Content>
        </Card>

        {user.role === "curator" && (
          <>
            <SectionHeader title="Curator" />
            <Card mode="outlined" style={styles.card}>
              <List.Item
                testID="settings-admin"
                title="Admin"
                description="Add places, log checks, make them live"
                left={(p) => <List.Icon {...p} icon="shield-account-outline" color={colors.primary} />}
                right={(p) => <List.Icon {...p} icon="chevron-right" />}
                onPress={() => router.push("/admin" as Href)}
              />
            </Card>
          </>
        )}

        <SectionHeader title="Settings" />
        <Card mode="outlined" style={styles.card}>
          <List.Item
            testID="settings-language"
            title="Language"
            description={LANGUAGE_NAMES[user.language] ?? user.language}
            left={(p) => <List.Icon {...p} icon="translate" color={colors.primary} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push("/settings/language")}
          />
          <Divider />
          <List.Item
            title="Festival reminders"
            description="Coming soon"
            left={(p) => <List.Icon {...p} icon="bell-outline" color={colors.primary} />}
            right={() => <Switch value={notifications} onValueChange={setNotifications} color={colors.primary} disabled />}
          />
        </Card>

        <SectionHeader title="Support" />
        <Card mode="outlined" style={styles.card}>
          <List.Item
            testID="settings-help"
            title="Help & FAQ"
            left={(p) => <List.Icon {...p} icon="help-circle-outline" color={colors.primary} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push("/settings/help")}
          />
          <Divider />
          <List.Item
            title="Share Tirth Yatra"
            left={(p) => <List.Icon {...p} icon="share-variant-outline" color={colors.primary} />}
            onPress={() => Share.share({ message: "Plan your tirth yatra with the Tirth Yatra app 🙏" }).catch(() => undefined)}
          />
          <Divider />
          <List.Item
            testID="settings-about"
            title="About"
            left={(p) => <List.Icon {...p} icon="information-outline" color={colors.primary} />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push("/settings/about")}
          />
        </Card>

        <Button testID="logout" title="Log out" variant="outline" icon="logout" onPress={logout} style={{ marginTop: spacing.lg }} />
      </View>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text variant="headlineSmall" style={{ color: colors.primary }}>
        {value}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.muted }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: "#fff" },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: -spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  card: { borderRadius: radius.lg, backgroundColor: colors.card, borderColor: colors.border },
  heading: { color: colors.text, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
});
