import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";

import { api } from "../../src/api";
import { PlaceCard } from "../../src/PlaceCard";
import { colors, spacing } from "../../src/theme";
import type { Place } from "../../src/types";
import { Button, Empty, ErrorText, PageHeader } from "../../src/ui";

export default function Saved() {
  const router = useRouter();
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

  return (
    <View style={{ flex: 1 }}>
      <PageHeader
        title="Saved places"
        subtitle={loading ? "Your bookmarked tirths" : `${places.length} place${places.length === 1 ? "" : "s"} bookmarked`}
        right={<MaterialCommunityIcons name="bookmark-multiple-outline" size={30} color="rgba(255,255,255,0.9)" />}
      />
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        <ErrorText testID="saved-error">{error}</ErrorText>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          testID="saved-list"
          data={places}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <PlaceCard place={item} onToggleSave={remove} />}
          ListEmptyComponent={
            <Empty
              icon="bookmark-outline"
              title="Nothing saved yet"
              hint="Tap the bookmark on any place to keep it here."
              action={<Button testID="saved-explore" title="Explore places" variant="tonal" icon="compass-outline" onPress={() => router.push("/")} />}
            />
          }
        />
      )}
    </View>
  );
}
