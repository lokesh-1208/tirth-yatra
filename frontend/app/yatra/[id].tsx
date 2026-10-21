import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Button as PaperButton, Checkbox, Dialog, Portal, ProgressBar, Text, TextInput } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fontFamily, KIND_LABEL, radius, spacing } from "../../src/theme";
import { Button, Empty, Hero, Pill, Placeholder, SectionHeader } from "../../src/ui";
import { useYatras } from "../../src/yatras";

export default function YatraDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { yatras, ready, toggleVisited, rename, remove } = useYatras();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const yatra = yatras.find((y) => y.id === id);
  if (!ready) return null;
  if (!yatra)
    return (
      <View style={{ flex: 1, paddingTop: insets.top + 64 }}>
        <Empty title="Yatra not found" hint="It may have been deleted." icon="map-marker-question-outline" />
      </View>
    );

  const done = yatra.stops.filter((s) => s.visited).length;
  const total = yatra.stops.length;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(yatra.start)}&destination=${encodeURIComponent(yatra.end)}`;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <Hero style={{ paddingTop: insets.top + 64 }}>
        <Text testID="yatra-name" variant="headlineMedium" style={{ color: "#fff" }}>
          {yatra.name}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 2 }} numberOfLines={2}>
          {yatra.start} → {yatra.end}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
          <Pill tone="onDark" icon="road-variant" label={`${yatra.total_km} km`} />
          <Pill tone="onDark" icon="map-marker-multiple" label={`${total} stops`} />
          <Pill tone="onDark" icon="check-circle-outline" label={`${done} visited`} />
        </View>
        <ProgressBar progress={total ? done / total : 0} color="#fff" style={styles.progress} />
      </Hero>

      <View style={{ paddingHorizontal: spacing.md }}>
        <View style={styles.actions}>
          <Button title="Directions" icon="navigation-variant" variant="tonal" onPress={() => Linking.openURL(mapsUrl)} style={{ flex: 1 }} />
          <Button
            testID="yatra-rename"
            title="Rename"
            icon="pencil-outline"
            variant="outline"
            onPress={() => {
              setNewName(yatra.name);
              setRenaming(true);
            }}
            style={{ flex: 1 }}
          />
        </View>

        <SectionHeader title="Stops on the way" />
        <View style={styles.timeline}>
          <TimelineNode icon="map-marker" title={yatra.start} subtitle="Start" first />
          {yatra.stops.map((s) => (
            <Pressable key={s.place_id} onPress={() => router.push(`/place/${s.place_id}`)} style={styles.stopRow}>
              <View style={styles.rail}>
                <View style={styles.railLine} />
                <View style={[styles.dot, s.visited && { backgroundColor: colors.success, borderColor: colors.success }]} />
                <View style={styles.railLine} />
              </View>
              <View style={[styles.stopCard, s.visited && { opacity: 0.75 }]}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleSmall" style={{ fontFamily: fontFamily.bold }} numberOfLines={2}>
                    {s.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.muted }}>
                    {[KIND_LABEL[s.kind] ?? s.kind, s.city].filter(Boolean).join(" · ")} · {s.distance_from_start_km} km from start
                  </Text>
                </View>
                <Checkbox.Android
                  testID={`yatra-stop-${s.place_id}`}
                  status={s.visited ? "checked" : "unchecked"}
                  color={colors.success}
                  onPress={() => toggleVisited(yatra.id, s.place_id)}
                />
              </View>
            </Pressable>
          ))}
          <TimelineNode icon="flag-checkered" title={yatra.end} subtitle="Destination" last />
        </View>

        <SectionHeader title="Notes & checklist" />
        <Placeholder text="Packing list, stay bookings and personal notes for this yatra will appear here." />

        <Button
          testID="yatra-delete"
          title="Delete this yatra"
          icon="delete-outline"
          variant="text"
          onPress={() => setConfirmDelete(true)}
          style={{ marginTop: spacing.lg }}
        />
      </View>

      <Portal>
        <Dialog visible={renaming} onDismiss={() => setRenaming(false)}>
          <Dialog.Title>Rename yatra</Dialog.Title>
          <Dialog.Content>
            <TextInput testID="yatra-rename-input" mode="outlined" value={newName} onChangeText={setNewName} autoFocus />
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={() => setRenaming(false)}>Cancel</PaperButton>
            <PaperButton
              testID="yatra-rename-save"
              disabled={!newName.trim()}
              onPress={async () => {
                await rename(yatra.id, newName.trim());
                setRenaming(false);
              }}
            >
              Save
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>Delete this yatra?</Dialog.Title>
          <Dialog.Content>
            <Text>Your visited checklist for this trip will be removed. Saved places stay saved.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={() => setConfirmDelete(false)}>Cancel</PaperButton>
            <PaperButton
              testID="yatra-delete-confirm"
              textColor={colors.danger}
              onPress={async () => {
                setConfirmDelete(false);
                await remove(yatra.id);
                router.back();
              }}
            >
              Delete
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function TimelineNode({
  icon,
  title,
  subtitle,
  first,
  last,
}: {
  icon: string;
  title: string;
  subtitle: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <View style={styles.stopRow}>
      <View style={styles.rail}>
        <View style={[styles.railLine, first && { backgroundColor: "transparent" }]} />
        <View style={styles.endpoint}>
          <MaterialCommunityIcons name={icon as any} size={16} color="#fff" />
        </View>
        <View style={[styles.railLine, last && { backgroundColor: "transparent" }]} />
      </View>
      <View style={{ flex: 1, paddingVertical: spacing.sm }}>
        <Text variant="labelSmall" style={{ color: colors.muted, textTransform: "uppercase" }}>
          {subtitle}
        </Text>
        <Text variant="titleSmall" numberOfLines={2}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { height: 6, borderRadius: 3, marginTop: spacing.md, backgroundColor: "rgba(255,255,255,0.3)" },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  timeline: { marginTop: spacing.xs },
  stopRow: { flexDirection: "row", alignItems: "stretch" },
  rail: { width: 32, alignItems: "center" },
  railLine: { flex: 1, width: 2, backgroundColor: colors.border },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.card },
  endpoint: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stopCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
  },
});
