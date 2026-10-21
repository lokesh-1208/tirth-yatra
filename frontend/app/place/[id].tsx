import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../../src/api";
import { colors, spacing } from "../../src/theme";
import type { Place } from "../../src/types";
import { Button, ErrorText } from "../../src/ui";

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [place, setPlace] = useState<Place | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .place(id)
      .then(setPlace)
      .catch((e) => setError(e.message));
  }, [id]);

  const toggleSave = async () => {
    if (!place) return;
    const prev = place.is_saved;
    setPlace({ ...place, is_saved: !prev });
    try {
      await (prev ? api.unsave(place.id) : api.save(place.id));
    } catch (e: any) {
      setPlace({ ...place, is_saved: prev });
      setError(e.message);
    }
  };

  if (error && !place) return <ErrorText>{error}</ErrorText>;
  if (!place) return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md }}>
      <Stack.Screen options={{ title: place.name }} />
      <Text testID="detail-name" style={styles.title}>
        {place.name}
      </Text>
      <Text style={styles.sub}>
        {[place.kind.replace("_", " "), place.sect, place.city, place.state].filter(Boolean).join(" · ")}
      </Text>

      {place.verified ? (
        <View style={[styles.badge, { backgroundColor: "#DCFCE7" }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={{ color: colors.success, fontWeight: "700", marginLeft: 6 }}>
            Verified{place.verified_by ? ` by ${place.verified_by}` : ""}
            {place.verified_on ? ` on ${place.verified_on}` : ""}
          </Text>
        </View>
      ) : (
        <View style={[styles.badge, { backgroundColor: colors.warnBg }]}>
          <Text testID="detail-unverified" style={{ color: colors.warnText, fontWeight: "700" }}>
            Not yet verified – details may be incomplete
          </Text>
        </View>
      )}

      <Section title="Deity" body={place.deity} />
      <Section title="About" body={place.description} />
      <Section title="How to reach" body={place.how_to_reach} />

      <ErrorText>{error}</ErrorText>
      <Button
        testID="detail-save"
        title={place.is_saved ? "Remove from saved" : "Save this place"}
        variant={place.is_saved ? "outline" : "primary"}
        onPress={toggleSave}
      />
      <View style={{ height: spacing.sm + 2 }} />
      <Pressable onPress={() => Linking.openURL(mapsUrl)} style={styles.link}>
        <Ionicons name="navigate" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: "700", marginLeft: 8 }}>Open in Google Maps</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  sub: { color: colors.muted, textTransform: "capitalize", marginTop: 4 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  heading: { fontSize: 13, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 4 },
  body: { fontSize: 16, color: colors.text, lineHeight: 22 },
  link: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: spacing.md },
});
