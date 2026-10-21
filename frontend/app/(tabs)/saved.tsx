import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";

import { api } from "../../src/api";
import { PlaceCard } from "../../src/PlaceCard";
import { colors, spacing } from "../../src/theme";
import type { Place } from "../../src/types";
import { Empty, ErrorText } from "../../src/ui";

export default function Saved() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const data = await api.saved();
          if (active) setPlaces(data);
        } catch (e: any) {
          if (active) setError(e.message);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const remove = async (p: Place) => {
    const before = places;
    setPlaces((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await api.unsave(p.id);
    } catch (e: any) {
      setPlaces(before);
      setError(e.message);
    }
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />;

  return (
    <View style={{ flex: 1, padding: spacing.md }}>
      <ErrorText testID="saved-error">{error}</ErrorText>
      <FlatList
        testID="saved-list"
        data={places}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <PlaceCard place={item} onToggleSave={remove} />}
        ListEmptyComponent={<Empty title="Nothing saved yet" hint="Tap the bookmark on any place to keep it here." />}
      />
    </View>
  );
}
