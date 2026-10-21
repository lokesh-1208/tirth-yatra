import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, spacing } from "../../src/theme";
import { Button, Chip, ErrorText } from "../../src/ui";

const FAITHS = ["jain", "hindu", "sikh", "muslim", "buddhist", "christian"];
const JAIN_SECTS = ["digambar", "shvetambar"];

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [faith, setFaith] = useState<string | null>(user?.faith ?? null);
  const [sect, setSect] = useState<string | null>(user?.sect ?? null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  if (!user) return null;
  const dirty = faith !== user.faith || sect !== user.sect;

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
    <ScrollView contentContainerStyle={{ padding: spacing.md }}>
      <View style={styles.card}>
        <Text testID="profile-name" style={styles.name}>
          {user.name}
        </Text>
        <Text testID="profile-email" style={{ color: colors.muted }}>
          {user.email}
        </Text>
      </View>

      <Text style={styles.heading}>My faith</Text>
      <View style={styles.chips}>
        {FAITHS.map((f) => (
          <Chip
            key={f}
            testID={`profile-faith-${f}`}
            label={f[0].toUpperCase() + f.slice(1)}
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
          <Text style={styles.heading}>Sect</Text>
          <View style={styles.chips}>
            {JAIN_SECTS.map((s) => (
              <Chip
                key={s}
                testID={`profile-sect-${s}`}
                label={s[0].toUpperCase() + s.slice(1)}
                selected={sect === s}
                onPress={() => setSect(sect === s ? null : s)}
              />
            ))}
          </View>
        </>
      )}

      <ErrorText testID="profile-error">{error}</ErrorText>
      {!!msg && (
        <Text testID="profile-msg" style={{ color: colors.success, marginBottom: spacing.sm }}>
          {msg}
        </Text>
      )}
      <Button testID="profile-save" title="Save preferences" onPress={save} loading={saving} disabled={!dirty} />
      <View style={{ height: spacing.md }} />
      <Button testID="logout" title="Log out" variant="outline" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  name: { fontSize: 20, fontWeight: "800", color: colors.text },
  heading: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.lg },
});
