import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { api } from "../../src/api";
import { PlaceCard } from "../../src/PlaceCard";
import { colors, spacing } from "../../src/theme";
import type { Place } from "../../src/types";
import { Chip, Empty, ErrorText } from "../../src/ui";

const SECTS = ["digambar", "shvetambar"];

export default function Explore() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [q, setQ] = useState("");
  const [sect, setSect] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setPlaces(await api.places({ q: q.trim(), sect }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, sect]);

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

  return (
    <View style={{ flex: 1, padding: spacing.md }}>
      <TextInput
        testID="explore-search"
        value={q}
        onChangeText={setQ}
        placeholder="Search by name or city"
        placeholderTextColor={colors.muted}
        style={styles.search}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: spacing.md }}>
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

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          testID="explore-list"
          data={places}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => <PlaceCard place={item} onToggleSave={toggleSave} />}
          ListEmptyComponent={<Empty title="No places found" hint="Try a different search or filter." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: spacing.sm + 2,
    color: colors.text,
  },
});
