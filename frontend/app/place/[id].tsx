import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Linking, ScrollView, Share, StyleSheet, View } from "react-native";
import { ActivityIndicator, IconButton, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatDate, METHOD_LABEL, ROLE_LABEL } from "../../src/admin";
import { api, assetUrl } from "../../src/api";
import { to } from "../../src/adminUi";
import { AutoCover } from "../../src/AutoCover";
import { capitalize, colors, fontFamily, KIND_LABEL, radius, spacing } from "../../src/theme";
import type { Place } from "../../src/types";
import { Button, Chip, ErrorText, Hero, Pill, Placeholder } from "../../src/ui";

type TabKey = "about" | "darshan" | "stay" | "food" | "reach";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "about", label: "About", icon: "information-outline" },
  { key: "darshan", label: "Darshan", icon: "clock-outline" },
  { key: "stay", label: "Stay", icon: "bed-outline" },
  { key: "food", label: "Bhojan", icon: "silverware-fork-knife" },
  { key: "reach", label: "Reach", icon: "car-outline" },
];

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("about");

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

  if (error && !place)
    return (
      <View style={{ padding: spacing.md, paddingTop: insets.top + 64 }}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  if (!place) return <ActivityIndicator color={colors.primary} style={{ marginTop: insets.top + 80 }} />;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
  const meta = [KIND_LABEL[place.kind] ?? place.kind, place.sect && place.sect !== "all" ? capitalize(place.sect) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <Hero style={{ paddingTop: insets.top + 64, paddingBottom: spacing.xl }}>
        {assetUrl(place.photo_url) ? (
          <Image testID="detail-cover-photo" source={{ uri: assetUrl(place.photo_url)! }} style={styles.photo} />
        ) : (
          // No cover photo yet: a made-up cover with the name, never a deity image.
          <AutoCover
            testID="detail-auto-cover"
            name={place.name}
            kind={place.kind}
            city={place.city}
            sect={place.sect}
            height={160}
            style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}
          />
        )}
        <Text testID="detail-name" variant="headlineMedium" style={{ color: "#fff", lineHeight: 40 }}>
          {place.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          <MaterialCommunityIcons name="map-marker-outline" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: "rgba(255,255,255,0.9)", marginLeft: 4 }}>
            {[place.city, place.state].filter(Boolean).join(", ")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
          {!!meta && <Pill tone="onDark" label={meta} />}
          {place.verified ? (
            <Pill
              testID="detail-verified"
              tone="success"
              icon="check-decagram"
              label={`Verified${place.verified_by ? ` by ${place.verified_by}` : ""}${place.verified_on ? ` on ${formatDate(place.verified_on)}` : ""}${
                place.verified_method ? ` · ${METHOD_LABEL[place.verified_method] ?? place.verified_method}` : ""
              }`}
            />
          ) : (
            <Pill testID="detail-unverified" tone="warn" icon="progress-clock" label="Not yet verified – details may be incomplete" />
          )}
        </View>
      </Hero>

      <View style={styles.actions}>
        <Action
          testID="detail-save"
          icon={place.is_saved ? "bookmark" : "bookmark-outline"}
          label={place.is_saved ? "Remove from saved" : "Save this place"}
          active={place.is_saved}
          onPress={toggleSave}
        />
        <Action testID="detail-directions" icon="navigation-variant-outline" label="Directions" onPress={() => Linking.openURL(mapsUrl)} />
        <Action
          testID="detail-call"
          icon="phone-outline"
          label="Call"
          disabled={!place.contact_phone}
          onPress={() => place.contact_phone && Linking.openURL(`tel:${place.contact_phone}`)}
        />
        <Action
          testID="detail-share"
          icon="share-variant-outline"
          label="Share"
          onPress={() => Share.share({ message: `${place.name}\n${mapsUrl}` }).catch(() => undefined)}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.md }}>
        <ErrorText>{error}</ErrorText>
        {!!place.landmarks && (
          <View testID="detail-landmarks" style={styles.landmarks}>
            <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={colors.secondary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text variant="labelLarge" style={{ color: colors.secondary, fontFamily: fontFamily.bold }}>
                Landmarks · work without network
              </Text>
              <Text style={styles.body}>{place.landmarks}</Text>
            </View>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          {TABS.map((t) => (
            <Chip key={t.key} testID={`detail-tab-${t.key}`} label={t.label} icon={t.icon} selected={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>

        {tab === "about" && (
          <>
            <Section icon="meditation" title="Moolnayak / Deity" body={place.deity} />
            <Section icon="text-box-outline" title="About" body={place.description} />
          </>
        )}
        {tab === "darshan" && <Section icon="clock-outline" title="Darshan & puja timings" body={place.darshan_timings} />}
        {tab === "stay" && <Section icon="bed-outline" title="Dharamshala & stay" body={place.stay_info} />}
        {tab === "food" && <Section icon="silverware-fork-knife" title="Bhojanshala (Jain food)" body={place.food_info} />}
        {tab === "reach" && (
          <>
            <Section icon="car-outline" title="How to reach" body={place.how_to_reach} />
            <Section icon="map-marker-radius-outline" title="Landmarks" body={place.landmarks ?? null} />
            <Section
              icon="phone-outline"
              title="Contact"
              body={
                place.contacts?.length
                  ? place.contacts.map((c) => `${c.name} (${ROLE_LABEL[c.role as keyof typeof ROLE_LABEL] ?? c.role}): ${c.phone}`).join("\n")
                  : place.contact_phone
              }
            />
            {!!place.address && <Section icon="home-map-marker" title="Address" body={place.address} />}
            <Button title="Open in Google Maps" icon="google-maps" variant="tonal" onPress={() => Linking.openURL(mapsUrl)} />
          </>
        )}

        <Button
          testID="detail-report"
          title="Something wrong here? Report it"
          icon="flag-outline"
          variant="text"
          onPress={() => router.push(to(`/report?placeId=${place.id}&placeName=${encodeURIComponent(place.name)}`))}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </ScrollView>
  );
}

function Action({
  icon,
  label,
  onPress,
  active,
  disabled,
  testID,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  testID: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <IconButton
        testID={testID}
        accessibilityLabel={label}
        icon={icon}
        mode="contained"
        size={24}
        disabled={disabled}
        containerColor={active ? colors.primary : colors.primaryLight}
        iconColor={active ? "#fff" : colors.primary}
        onPress={onPress}
      />
      <Text variant="labelSmall" style={{ color: disabled ? colors.muted : colors.text, textAlign: "center" }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function Section({ icon, title, body }: { icon: string; title: string; body: string | null }) {
  return (
    <View style={styles.section}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
        <MaterialCommunityIcons name={icon as any} size={18} color={colors.primary} />
        <Text variant="labelLarge" style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {body ? <Text style={styles.body}>{body}</Text> : <Placeholder />}
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: "100%", height: 180, borderRadius: radius.lg, marginBottom: spacing.md },
  landmarks: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: "row",
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: -spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { marginLeft: spacing.sm, color: colors.muted, textTransform: "uppercase", fontFamily: fontFamily.bold },
  body: { fontSize: 16, color: colors.text, lineHeight: 24 },
});
