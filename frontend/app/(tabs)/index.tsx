import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Searchbar, Text } from "react-native-paper";

import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { PlaceCard } from "../../src/PlaceCard";
import { colors, fontFamily, KIND_ICON, KIND_LABEL, radius, spacing } from "../../src/theme";
import type { Place } from "../../src/types";
import { Chip, Empty, ErrorText, PageHeader, Pill, SectionHeader } from "../../src/ui";

const SECTS = ["digambar", "shvetambar"];
const KINDS = ["tirth", "atishay_kshetra", "temple", "dharamshala"];

// Placeholder festival cards. TODO(data): load real dates from the backend (Jain calendar / panchang).
const FESTIVALS = [
  { name: "Mahavir Jayanti", icon: "white-balance-sunny" },
  { name: "Paryushan Parv", icon: "hands-pray" },
  { name: "Das Lakshan Parv", icon: "flower-tulip-outline" },
  { name: "Deepawali (Nirvan Kalyanak)", icon: "candle" },
] as const;

export default function Explore() {
  const { user } = useAuth();
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [q, setQ] = useState("");
  const [sect, setSect] = useState<string | undefined>();
  const [kind, setKind] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setPlaces(await api.places({ q: q.trim(), sect, kind }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, sect, kind]);

  // reload whenever the tab is focused or filters change
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(load, 250); // light debounce for typing
      return () => clearTimeout(t);
    }, [load])
  );

  const toggleSave = async (p: Place) => {
    setPlaces((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_saved: !x.is_saved } : x))); // optimistic
    try {
      await (p.is_saved ? api.unsave(p.id) : api.save(p.id));
    } catch (e: any) {
      setPlaces((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_saved: p.is_saved } : x)));
      setError(e.message);
    }
  };

  const firstName = user?.name?.split(" ")[0];

  const header = (
    <View>
      <PageHeader
        title={firstName ? `Jai Jinendra, ${firstName}` : "Jai Jinendra"}
        subtitle="Discover tirths and temples for your next yatra"
        right={<MaterialCommunityIcons name="hands-pray" size={30} color="rgba(255,255,255,0.9)" />}
      >
        <Searchbar
          testID="explore-search"
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or city"
          style={styles.search}
          inputStyle={{ fontFamily: fontFamily.regular }}
          iconColor={colors.primary}
          elevation={0}
        />
      </PageHeader>

      <View style={styles.body}>
        <Pressable testID="explore-plan-cta" onPress={() => router.push("/plan")} style={styles.cta}>
          <View style={styles.ctaIcon}>
            <MaterialCommunityIcons name="map-marker-path" size={26} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleMedium" style={{ fontFamily: fontFamily.bold, color: colors.secondary }}>
              Plan a route yatra
            </Text>
            <Text variant="bodySmall" style={{ color: colors.muted }}>
              Enter From and To, see every tirth on the way
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.secondary} />
        </Pressable>

        <SectionHeader title="Browse by type" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.md }}>
          <KindTile label="All places" icon="view-grid-outline" selected={!kind} onPress={() => setKind(undefined)} testID="kind-all" />
          {KINDS.map((k) => (
            <KindTile
              key={k}
              testID={`kind-${k}`}
              label={KIND_LABEL[k]}
              icon={KIND_ICON[k]}
              selected={kind === k}
              onPress={() => setKind(kind === k ? undefined : k)}
            />
          ))}
        </ScrollView>

        <SectionHeader title="Parv & Utsav" action={<Pill label="Dates coming soon" tone="warn" />} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FESTIVALS.map((f) => (
            <View key={f.name} style={styles.festival} testID="festival-card">
              <MaterialCommunityIcons name={f.icon} size={24} color={colors.gold} />
              <Text variant="titleSmall" style={{ marginTop: spacing.sm }} numberOfLines={2}>
                {f.name}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.muted }}>
                Date to be added
              </Text>
            </View>
          ))}
        </ScrollView>

        <SectionHeader title={loading ? "Places" : `Places (${places.length})`} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <Chip label="All" selected={!sect} onPress={() => setSect(undefined)} testID="filter-all" />
          {SECTS.map((s) => (
            <Chip
              key={s}
              testID={`filter-${s}`}
              label={s[0].toUpperCase() + s.slice(1)}
              selected={sect === s}
              onPress={() => setSect(sect === s ? undefined : s)}
            />
          ))}
        </ScrollView>

        <ErrorText testID="explore-error">{error}</ErrorText>
      </View>
    </View>
  );

  return (
    <FlatList
      testID="explore-list"
      data={loading ? [] : places}
      keyExtractor={(p) => String(p.id)}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: spacing.md }}>
          <PlaceCard place={item} onToggleSave={toggleSave} />
        </View>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <Empty title="No places found" hint="Try a different search or filter." />
        )
      }
      contentContainerStyle={{ paddingBottom: spacing.xl }}
    />
  );
}

function KindTile({
  label,
  icon,
  selected,
  onPress,
  testID,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.tile, selected && styles.tileSelected]}>
      <View style={[styles.tileIcon, selected && { backgroundColor: "rgba(255,255,255,0.2)" }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color={selected ? "#fff" : colors.primary} />
      </View>
      <Text variant="labelMedium" style={{ color: selected ? "#fff" : colors.text, textAlign: "center" }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: spacing.md, borderRadius: radius.md, backgroundColor: "#fff" },
  body: { paddingHorizontal: spacing.md },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  tile: {
    width: 96,
    alignItems: "center",
    padding: spacing.sm + 2,
    marginRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  festival: {
    width: 150,
    padding: spacing.md,
    marginRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.goldLight,
  },
});
