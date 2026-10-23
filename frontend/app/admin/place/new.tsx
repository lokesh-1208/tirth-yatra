import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

import { emptyForm, formToInput, KINDS, PlaceForm, SECTS, validateForm } from "../../../src/admin";
import { AdminSection, ChoiceChips, FieldCell, FieldLabel, FieldRow, Note, to } from "../../../src/adminUi";
import { adminApi } from "../../../src/api";
import { LocationPicker } from "../../../src/LocationPicker";
import { colors, spacing } from "../../../src/theme";
import { Button, ErrorText, Input } from "../../../src/ui";

/** Step 1 of adding a place: the basics and the pin. Everything else is filled in the editor. */
export default function NewPlace() {
  const params = useLocalSearchParams<{ lead?: string; name?: string; area?: string }>();
  const router = useRouter();
  const [form, setForm] = useState<PlaceForm>(() => emptyForm({ name: params.name ?? "", city: params.area ?? "" }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<PlaceForm>) => setForm((f) => ({ ...f, ...patch }));

  const create = async () => {
    setError("");
    const errs = validateForm(form);
    setErrors(errs as Record<string, string>);
    if (Object.keys(errs).length) return setError("Fix the highlighted fields.");
    setSaving(true);
    try {
      const place = await adminApi.createPlace({ ...formToInput(form), lead_id: params.lead ? Number(params.lead) : undefined });
      router.replace(to(`/admin/place/${place.id}`));
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" style={{ marginBottom: spacing.xs }}>
        Add a place
      </Text>
      <Text style={{ color: colors.muted, marginBottom: spacing.md }}>
        It starts as a draft. Pilgrims see it only after you log a check and make it live.
      </Text>
      {!!params.lead && <Note icon="phone-check-outline">This draft will be linked to the lead you picked.</Note>}

      <AdminSection title="Basics">
        <Input
          testID="new-place-name"
          label="Name (as pilgrims should see it)"
          value={form.name}
          error={errors.name}
          onChangeText={(name) => set({ name })}
        />
        <FieldLabel>Sect</FieldLabel>
        <ChoiceChips options={SECTS} value={form.sect} onChange={(sect) => set({ sect })} testIDPrefix="new-place-sect" />
        <FieldLabel>Kind of place</FieldLabel>
        <ChoiceChips options={KINDS} value={form.kind} onChange={(kind) => set({ kind })} testIDPrefix="new-place-kind" />
        <FieldRow>
          <FieldCell min={180}>
            <Input testID="new-place-city" label="Town" value={form.city} onChangeText={(city) => set({ city })} />
          </FieldCell>
          <FieldCell min={180}>
            <Input testID="new-place-district" label="District" value={form.district} onChangeText={(district) => set({ district })} />
          </FieldCell>
          <FieldCell min={180}>
            <Input testID="new-place-state" label="State" value={form.state} onChangeText={(state) => set({ state })} />
          </FieldCell>
        </FieldRow>
      </AdminSection>

      <AdminSection title="Location">
        <LocationPicker
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(latitude, longitude) => set({ latitude, longitude })}
          errors={errors}
        />
      </AdminSection>

      <ErrorText testID="new-place-error">{error}</ErrorText>
      <Button testID="new-place-create" title="Create draft and continue" icon="arrow-right" onPress={create} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 900, alignSelf: "center" },
});
