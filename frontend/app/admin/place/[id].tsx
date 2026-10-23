import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Menu, Text } from "react-native-paper";

import {
  changedFields,
  formatDate,
  formFromPlace,
  KINDS,
  languageLabel,
  LANGUAGES,
  METHOD_LABEL,
  PlaceForm,
  publishBlocker,
  recheckLabel,
  SECTS,
  translationForm,
  TRANSLATABLE,
  validateForm,
} from "../../../src/admin";
import { AdminSection, ChoiceChips, CoverThumb, FieldCell, FieldLabel, FieldRow, Note, StatusPill, to } from "../../../src/adminUi";
import { ChecksPanel, ContactsPanel, PhotosPanel } from "../../../src/adminPanels";
import { adminApi } from "../../../src/api";
import { useAuth } from "../../../src/auth";
import { LocationPicker } from "../../../src/LocationPicker";
import { colors, fontFamily, radius, spacing } from "../../../src/theme";
import type { AdminPlace, PlaceStatus, TranslatableFields } from "../../../src/types";
import { Button, Chip, ErrorText, Input, SuccessText } from "../../../src/ui";

type TrForm = Record<keyof TranslatableFields, string>;

const TR_LABELS: Record<keyof TranslatableFields, string> = {
  name: "Name",
  description: "About",
  how_to_reach: "How to reach",
  darshan_timings: "Darshan timings",
  stay_info: "Stay (dharamshala)",
  food_info: "Bhojan",
  landmarks: "Landmarks",
};

export default function PlaceEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();
  const [place, setPlace] = useState<AdminPlace | null>(null);
  const [saved, setSaved] = useState<PlaceForm | null>(null); // form as last saved, to find changes
  const [form, setForm] = useState<PlaceForm | null>(null);
  const [lang, setLang] = useState<string>("en");
  const [trSaved, setTrSaved] = useState<TrForm | null>(null);
  const [tr, setTr] = useState<TrForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [langMenu, setLangMenu] = useState(false);
  const [extraLangs, setExtraLangs] = useState<string[]>([]); // added in this session, not saved yet

  /** Take a fresh copy from the server; keep unsaved edits unless `resetForm`. */
  const apply = useCallback((p: AdminPlace, resetForm: boolean) => {
    setPlace(p);
    const f = formFromPlace(p);
    setSaved(f);
    if (resetForm) setForm(f);
  }, []);

  const reload = useCallback(
    async (fresh?: AdminPlace) => {
      try {
        apply(fresh ?? (await adminApi.place(id)), false);
      } catch (e: any) {
        setError(e.message);
      }
    },
    [apply, id]
  );

  useEffect(() => {
    adminApi
      .place(id)
      .then((p) => {
        apply(p, true);
        setLang(p.default_language);
      })
      .catch((e) => setError(e.message));
  }, [apply, id]);

  useEffect(() => {
    if (place) navigation.setOptions({ title: place.name });
  }, [navigation, place]);

  const isDefault = !!place && lang === place.default_language;

  // When switching to another language, load its saved text.
  useEffect(() => {
    if (!place || isDefault) return;
    const f = translationForm(place, lang);
    setTrSaved(f);
    setTr(f);
  }, [place, lang, isDefault]);

  const languages = useMemo(() => {
    if (!place) return [];
    const have = [place.default_language, ...place.translations.map((t) => t.language), ...extraLangs];
    return Array.from(new Set(have));
  }, [place, extraLangs]);

  if (!place || !form) {
    return error ? (
      <View style={styles.page}>
        <ErrorText testID="editor-load-error">{error}</ErrorText>
      </View>
    ) : (
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
    );
  }

  const set = (patch: Partial<PlaceForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const changes = saved ? changedFields(saved, form) : {};
  const trDirty = !isDefault && tr && trSaved && TRANSLATABLE.some((k) => tr[k] !== trSaved[k]);
  const dirty = isDefault ? Object.keys(changes).length > 0 : !!trDirty;
  const blocker = publishBlocker(place);

  const save = async () => {
    setError("");
    setMsg("");
    if (isDefault) {
      const errs = validateForm(form);
      setErrors(errs as Record<string, string>);
      if (Object.keys(errs).length) return setError("Fix the highlighted fields.");
    }
    setSaving(true);
    try {
      if (isDefault) {
        apply(await adminApi.updatePlace(place.id, changes), true);
      } else if (tr) {
        const body = Object.fromEntries(TRANSLATABLE.map((k) => [k, tr[k].trim() || null]));
        apply(await adminApi.saveTranslation(place.id, lang, body), false);
        setExtraLangs((l) => l.filter((x) => x !== lang));
      }
      setMsg("Saved");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: PlaceStatus) => {
    setError("");
    setMsg("");
    setStatusBusy(true);
    try {
      apply(await adminApi.setStatus(place.id, status), false);
      setMsg(status === "live" ? "It is live: pilgrims can see it now." : "Status updated");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setStatusBusy(false);
    }
  };

  const removeLanguage = async () => {
    setError("");
    if (!place.translations.some((t) => t.language === lang)) {
      setExtraLangs((l) => l.filter((x) => x !== lang));
      return setLang(place.default_language);
    }
    try {
      apply(await adminApi.deleteTranslation(place.id, lang), false);
      setLang(place.default_language);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {/* Header: cover, name, status and the publish actions */}
      <View style={styles.header}>
        <View style={styles.headerCover}>
          <CoverThumb url={place.cover_url} name={place.name} kind={place.kind} city={place.city} sect={place.sect} height={150} />
        </View>
        <View style={{ flex: 1, minWidth: 240, gap: spacing.xs }}>
          <Text testID="editor-title" variant="headlineSmall" style={{ fontFamily: fontFamily.display }}>
            {place.name}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
            <StatusPill status={place.status} testID="editor-status" />
            <Text variant="bodySmall" style={{ color: place.verified ? colors.success : colors.warnText }}>
              {place.verified
                ? `Checked ${formatDate(place.verified_on)} by ${place.verified_by ?? "?"}${place.verified_method ? ` (${METHOD_LABEL[place.verified_method]})` : ""} · ${recheckLabel(place.recheck_due)}`
                : "Not checked yet"}
            </Text>
          </View>
          <View style={styles.statusActions}>
            {place.status !== "live" && (
              <Button
                testID="editor-make-live"
                title="Make live"
                icon="earth"
                onPress={() => changeStatus("live")}
                disabled={!!blocker}
                loading={statusBusy}
              />
            )}
            {place.status === "draft" && (
              <Button testID="editor-send-review" title="Mark in review" variant="outline" onPress={() => changeStatus("in_review")} loading={statusBusy} />
            )}
            {place.status === "live" && (
              <Button testID="editor-hide" title="Hide from app" icon="eye-off-outline" variant="outline" onPress={() => changeStatus("hidden")} loading={statusBusy} />
            )}
            {place.status === "hidden" && (
              <Button testID="editor-back-to-draft" title="Back to draft" variant="text" onPress={() => changeStatus("draft")} loading={statusBusy} />
            )}
          </View>
          {place.status !== "live" && !!blocker && <Note icon="alert-circle-outline">{blocker}</Note>}
          <Button
            testID="editor-reports"
            title="Pilgrim reports for this place"
            icon="flag-outline"
            variant="text"
            onPress={() => router.push(to(`/admin/reviews?place=${place.id}`))}
            style={{ alignSelf: "flex-start" }}
          />
          {user?.role === "admin" && (
            <Button
              testID="editor-history"
              title="Change history"
              icon="history"
              variant="text"
              onPress={() => router.push(to(`/admin/activity?type=place&target=${place.id}`))}
              style={{ alignSelf: "flex-start" }}
            />
          )}
        </View>
      </View>

      <ErrorText testID="editor-error">{error}</ErrorText>
      <SuccessText testID="editor-msg">{msg}</SuccessText>

      {/* Language switcher: the place's own fields are the default language; others are translations */}
      <AdminSection title="Editing in" hint="Name, About, Visiting and Landmarks are saved per language." testID="editor-languages">
        <View style={styles.chips}>
          {languages.map((code) => (
            <Chip
              key={code}
              testID={`editor-lang-${code}`}
              label={`${languageLabel(code)}${code === place.default_language ? " · main" : ""}`}
              selected={lang === code}
              onPress={() => {
                setMsg("");
                setLang(code);
              }}
            />
          ))}
          <Menu
            visible={langMenu}
            onDismiss={() => setLangMenu(false)}
            anchor={<Chip testID="editor-lang-add" label="+ Language" icon="translate" selected={false} onPress={() => setLangMenu(true)} />}
          >
            {LANGUAGES.filter((l) => !languages.includes(l.code)).map((l) => (
              <Menu.Item
                key={l.code}
                testID={`editor-lang-option-${l.code}`}
                title={l.label}
                onPress={() => {
                  setLangMenu(false);
                  setExtraLangs((x) => [...x, l.code]);
                  setLang(l.code);
                }}
              />
            ))}
          </Menu>
        </View>
        {!isDefault && (
          <Note>
            Fill what you have in {languageLabel(lang)}. Empty fields show the {languageLabel(place.default_language)} text to pilgrims.
          </Note>
        )}
      </AdminSection>

      {isDefault ? (
        <>
          <AdminSection title="Basics" testID="editor-basics">
            <Input
              testID="editor-name"
              label="Name (as pilgrims should see it)"
              value={form.name}
              error={errors.name}
              onChangeText={(name) => set({ name })}
            />
            <FieldLabel>Sect</FieldLabel>
            <ChoiceChips options={SECTS} value={form.sect} onChange={(sect) => set({ sect })} testIDPrefix="editor-sect" />
            <FieldLabel>Kind of place</FieldLabel>
            <ChoiceChips options={KINDS} value={form.kind} onChange={(kind) => set({ kind })} testIDPrefix="editor-kind" />
            <Input testID="editor-deity" label="Moolnayak" value={form.deity} onChangeText={(deity) => set({ deity })} />
            <Input
              testID="editor-description"
              label="About (in your own words)"
              value={form.description}
              onChangeText={(description) => set({ description })}
              multiline
            />
          </AdminSection>

          <AdminSection title="Location" testID="editor-location">
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(latitude, longitude) => set({ latitude, longitude })}
              errors={errors}
            />
            <Input testID="editor-address" label="Address" value={form.address} onChangeText={(address) => set({ address })} />
            <FieldRow>
              <FieldCell min={160}>
                <Input testID="editor-city" label="Town" value={form.city} onChangeText={(city) => set({ city })} />
              </FieldCell>
              <FieldCell min={160}>
                <Input testID="editor-district" label="District" value={form.district} onChangeText={(district) => set({ district })} />
              </FieldCell>
              <FieldCell min={160}>
                <Input testID="editor-state" label="State" value={form.state} onChangeText={(state) => set({ state })} />
              </FieldCell>
              <FieldCell min={120}>
                <Input
                  testID="editor-pincode"
                  label="Pincode"
                  keyboardType="number-pad"
                  value={form.pincode}
                  error={errors.pincode}
                  onChangeText={(pincode) => set({ pincode })}
                />
              </FieldCell>
            </FieldRow>
            <Input
              testID="editor-landmarks"
              label="Landmarks (to find it without network)"
              placeholder="e.g. turn left after the river bridge; gate faces the ghat"
              value={form.landmarks}
              onChangeText={(landmarks) => set({ landmarks })}
              multiline
            />
          </AdminSection>

          <AdminSection title="Visiting" testID="editor-visiting">
            <FieldRow>
              <FieldCell>
                <Input
                  testID="editor-darshan"
                  label="Darshan timings"
                  value={form.darshan_timings}
                  onChangeText={(darshan_timings) => set({ darshan_timings })}
                  multiline
                />
              </FieldCell>
              <FieldCell>
                <Input testID="editor-stay" label="Stay (dharamshala)" value={form.stay_info} onChangeText={(stay_info) => set({ stay_info })} multiline />
              </FieldCell>
              <FieldCell>
                <Input testID="editor-food" label="Bhojan" value={form.food_info} onChangeText={(food_info) => set({ food_info })} multiline />
              </FieldCell>
              <FieldCell>
                <Input
                  testID="editor-reach"
                  label="How to reach"
                  value={form.how_to_reach}
                  onChangeText={(how_to_reach) => set({ how_to_reach })}
                  multiline
                />
              </FieldCell>
            </FieldRow>
          </AdminSection>
        </>
      ) : (
        tr && (
          <AdminSection title={`Text in ${languageLabel(lang)}`} testID="editor-translation">
            {TRANSLATABLE.map((k) => (
              <Input
                key={k}
                testID={`editor-tr-${k}`}
                label={TR_LABELS[k]}
                placeholder={(place[k] as string | null) ?? ""}
                value={tr[k]}
                onChangeText={(v) => setTr((t) => (t ? { ...t, [k]: v } : t))}
                multiline={k !== "name"}
              />
            ))}
            <Button testID="editor-tr-remove" title={`Remove ${languageLabel(lang)} text`} variant="text" icon="delete-outline" onPress={removeLanguage} />
          </AdminSection>
        )
      )}

      <View style={styles.saveBar}>
        <Button
          testID="editor-save"
          title={dirty ? "Save changes" : "No changes to save"}
          icon="content-save-outline"
          onPress={save}
          loading={saving}
          disabled={!dirty}
        />
      </View>

      <ContactsPanel place={place} onChanged={reload} />
      <PhotosPanel place={place} onChanged={reload} />
      <ChecksPanel place={place} onChanged={reload} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl * 2, width: "100%", maxWidth: 1000, alignSelf: "center" },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerCover: { flexBasis: 260, flexGrow: 1, maxWidth: 360 },
  statusActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  saveBar: { marginBottom: spacing.lg },
});
