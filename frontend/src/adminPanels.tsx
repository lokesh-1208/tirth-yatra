import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Checkbox, Switch, Text } from "react-native-paper";

import { formatDate, METHOD_LABEL, RECHECK_MONTHS, ROLE_LABEL, todayIso } from "./admin";
import { AdminSection, ChoiceChips, CoverThumb, FieldCell, FieldLabel, FieldRow, Note } from "./adminUi";
import { adminApi, assetUrl } from "./api";
import { pickImage } from "./device";
import { colors, fontFamily, radius, spacing } from "./theme";
import type { AdminPlace, CheckMethod, ContactRole } from "./types";
import { Button, ErrorText, Input, SuccessText } from "./ui";

type PanelProps = { place: AdminPlace; onChanged: (p?: AdminPlace) => void };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROLES = (Object.keys(ROLE_LABEL) as ContactRole[]).map((value) => ({ value, label: ROLE_LABEL[value] }));
const METHODS = (Object.keys(METHOD_LABEL) as CheckMethod[]).map((value) => ({ value, label: METHOD_LABEL[value] }));

/** A delete button that asks for a second tap, so nothing is removed by accident. */
function ConfirmButton({ title, onConfirm, testID }: { title: string; onConfirm: () => Promise<void> | void; testID: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      testID={testID}
      title={armed ? "Tap again to confirm" : title}
      variant={armed ? "danger" : "text"}
      icon="delete-outline"
      onPress={async () => {
        if (!armed) return setArmed(true);
        setArmed(false);
        await onConfirm();
      }}
    />
  );
}

// --- contacts ----------------------------------------------------------------------------------

export function ContactsPanel({ place, onChanged }: PanelProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<ContactRole>("manager");
  const [phone, setPhone] = useState("");
  const [consentOn, setConsentOn] = useState("");
  const [showPublicly, setShowPublicly] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setError("");
    if (name.trim().length < 2) return setError("Enter the person’s name.");
    if (!phone.trim()) return setError("Enter a phone number.");
    if (consentOn && !ISO_DATE.test(consentOn)) return setError("Write the date as YYYY-MM-DD.");
    if (showPublicly && !consentOn) return setError("Record when they agreed to be listed before showing them to pilgrims.");
    setSaving(true);
    try {
      await adminApi.addContact(place.id, { name: name.trim(), role, phone, consent_on: consentOn || null, show_publicly: showPublicly });
      setName("");
      setPhone("");
      setConsentOn("");
      setShowPublicly(false);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: number, value: boolean) => {
    setError("");
    try {
      await adminApi.updateContact(place.id, id, { show_publicly: value });
      onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <AdminSection
      title="Contacts"
      hint="Local people who can confirm details. Shown to pilgrims only with their consent."
      testID="editor-contacts"
    >
      {place.contacts.map((c) => (
        <View key={c.id} style={styles.item} testID={`editor-contact-${c.id}`}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text style={{ fontFamily: fontFamily.semibold }}>
              {c.name} · {ROLE_LABEL[c.role] ?? c.role}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.muted }}>
              {c.phone} · {c.consent_on ? `agreed on ${formatDate(c.consent_on)}` : "consent not recorded"}
            </Text>
          </View>
          <View style={styles.inline}>
            <Text variant="bodySmall">Show to pilgrims</Text>
            <Switch
              testID={`editor-contact-public-${c.id}`}
              value={c.show_publicly}
              onValueChange={(v) => toggle(c.id, v)}
              disabled={!c.consent_on && !c.show_publicly}
              color={colors.success}
            />
          </View>
          <ConfirmButton
            testID={`editor-contact-delete-${c.id}`}
            title="Remove"
            onConfirm={async () => {
              await adminApi.deleteContact(place.id, c.id);
              onChanged();
            }}
          />
        </View>
      ))}
      {place.contacts.length === 0 && <Text style={{ color: colors.muted, marginBottom: spacing.md }}>No contacts yet.</Text>}

      <View style={styles.addBox}>
        <FieldLabel>Add a contact</FieldLabel>
        <FieldRow>
          <FieldCell min={200}>
            <Input testID="contact-name" label="Name" value={name} onChangeText={setName} />
          </FieldCell>
          <FieldCell min={180}>
            <Input testID="contact-phone" label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          </FieldCell>
        </FieldRow>
        <ChoiceChips options={ROLES} value={role} onChange={setRole} testIDPrefix="contact-role" />
        <FieldRow>
          <FieldCell min={200}>
            <Input
              testID="contact-consent"
              label="Agreed to be listed on (YYYY-MM-DD)"
              value={consentOn}
              onChangeText={setConsentOn}
            />
          </FieldCell>
          <FieldCell min={160}>
            <Button testID="contact-consent-today" title="They agreed today" variant="text" icon="calendar-check" onPress={() => setConsentOn(todayIso())} />
          </FieldCell>
        </FieldRow>
        <View style={styles.inline}>
          <Checkbox.Android
            testID="contact-public"
            status={showPublicly ? "checked" : "unchecked"}
            onPress={() => setShowPublicly(!showPublicly)}
            color={colors.success}
          />
          <Text>Show this person to pilgrims</Text>
        </View>
        <ErrorText testID="contact-error">{error}</ErrorText>
        <Button testID="contact-add" title="Add contact" icon="account-plus-outline" variant="tonal" onPress={add} loading={saving} />
      </View>
    </AdminSection>
  );
}

// --- photos ------------------------------------------------------------------------------------

export function PhotosPanel({ place, onChanged }: PanelProps) {
  const [photographer, setPhotographer] = useState("");
  const [permission, setPermission] = useState("");
  const [caption, setCaption] = useState("");
  const [noDeity, setNoDeity] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const cover = place.photos.find((p) => p.is_cover);

  const upload = async () => {
    setError("");
    if (!noDeity) return setError("Confirm the photo shows no deity image.");
    setUploading(true);
    try {
      const picked = await pickImage();
      if (!picked) return;
      await adminApi.uploadPhoto(place.id, picked.blob, picked.name, {
        no_deity_confirmed: true,
        photographer: photographer.trim() || undefined,
        permission_note: permission.trim() || undefined,
        caption: caption.trim() || undefined,
      });
      setCaption("");
      setNoDeity(false);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const setCover = async (photoId: number, value: boolean) => {
    setError("");
    try {
      await adminApi.updatePhoto(place.id, photoId, { is_cover: value });
      onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <AdminSection
      title="Cover photo"
      hint="Uploaded by the Tirth Yatra team only. Show the mandir or kshetra, never the deity."
      testID="editor-photos"
    >
      <Text variant="labelLarge" style={{ marginBottom: spacing.sm }}>
        {cover ? "Pilgrims see this cover" : "No cover yet: pilgrims see this auto cover"}
      </Text>
      <View style={{ maxWidth: 420, marginBottom: spacing.md }}>
        <CoverThumb
          testID="editor-cover-preview"
          url={cover?.url ?? null}
          name={place.name}
          kind={place.kind}
          city={place.city}
          sect={place.sect}
          height={200}
        />
      </View>

      {place.photos.length > 0 && (
        <View style={styles.grid}>
          {place.photos.map((p) => (
            <View key={p.id} style={styles.photoCard} testID={`editor-photo-${p.id}`}>
              <Image source={{ uri: assetUrl(p.url) ?? undefined }} style={styles.photo} accessibilityLabel={p.caption ?? "Place photo"} />
              <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.muted }}>
                {[p.caption, p.photographer && `by ${p.photographer}`, p.permission_note].filter(Boolean).join(" · ") || "No details"}
              </Text>
              {p.is_cover ? (
                <Button testID={`editor-photo-uncover-${p.id}`} title="Use auto cover instead" variant="text" onPress={() => setCover(p.id, false)} />
              ) : (
                <Button testID={`editor-photo-cover-${p.id}`} title="Make cover" variant="text" icon="image-check-outline" onPress={() => setCover(p.id, true)} />
              )}
              <ConfirmButton
                testID={`editor-photo-delete-${p.id}`}
                title="Delete"
                onConfirm={async () => {
                  await adminApi.deletePhoto(place.id, p.id);
                  onChanged();
                }}
              />
            </View>
          ))}
        </View>
      )}

      <View style={styles.addBox}>
        <FieldLabel>Upload a photo</FieldLabel>
        <FieldRow>
          <FieldCell min={180}>
            <Input testID="photo-photographer" label="Photographer" value={photographer} onChangeText={setPhotographer} />
          </FieldCell>
          <FieldCell min={220}>
            <Input testID="photo-permission" label="Permission (who allowed it)" value={permission} onChangeText={setPermission} />
          </FieldCell>
        </FieldRow>
        <Input testID="photo-caption" label="Caption (optional)" value={caption} onChangeText={setCaption} />
        <View style={styles.inline}>
          <Checkbox.Android testID="photo-no-deity" status={noDeity ? "checked" : "unchecked"} onPress={() => setNoDeity(!noDeity)} color={colors.success} />
          <Text>I confirm this photo shows no deity image</Text>
        </View>
        <Note>The first photo becomes the cover. JPEG, PNG or WebP, up to 5 MB.</Note>
        <ErrorText testID="photo-error">{error}</ErrorText>
        <Button testID="photo-upload" title="Choose photo and upload" icon="upload" variant="tonal" onPress={upload} loading={uploading} />
      </View>
    </AdminSection>
  );
}

// --- checks ------------------------------------------------------------------------------------

export function ChecksPanel({ place, onChanged }: PanelProps) {
  const [method, setMethod] = useState<CheckMethod>("call");
  const [checkedWith, setCheckedWith] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [checkedOn, setCheckedOn] = useState(todayIso());
  const [months, setMonths] = useState("6");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError("");
    setMsg("");
    if (!ISO_DATE.test(checkedOn)) return setError("Write the date as YYYY-MM-DD.");
    if (checkedOn > todayIso()) return setError("A check cannot be dated in the future.");
    setSaving(true);
    try {
      const updated = await adminApi.logCheck(place.id, {
        method,
        checked_with: checkedWith.trim() || undefined,
        confirmed: confirmed.trim() || undefined,
        checked_on: checkedOn,
        recheck_after_months: Number(months),
      });
      setCheckedWith("");
      setConfirmed("");
      setMsg("Check saved");
      onChanged(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminSection title="Log a check" hint="Each call, visit or local reference you used to confirm the details." testID="editor-checks">
      <FieldLabel>How did you check?</FieldLabel>
      <ChoiceChips options={METHODS} value={method} onChange={setMethod} testIDPrefix="check-method" />
      <Input testID="check-with" label="Checked with (person and role)" value={checkedWith} onChangeText={setCheckedWith} />
      <Input testID="check-confirmed" label="What was confirmed" value={confirmed} onChangeText={setConfirmed} multiline />
      <FieldRow>
        <FieldCell min={180}>
          <Input testID="check-date" label="Date (YYYY-MM-DD)" value={checkedOn} onChangeText={setCheckedOn} />
        </FieldCell>
      </FieldRow>
      <FieldLabel>Re-check after</FieldLabel>
      <ChoiceChips
        options={RECHECK_MONTHS.map((m) => ({ value: String(m), label: `${m} months` }))}
        value={months}
        onChange={setMonths}
        testIDPrefix="check-months"
      />
      <ErrorText testID="check-error">{error}</ErrorText>
      <SuccessText testID="check-msg">{msg}</SuccessText>
      <Button testID="check-save" title="Save check" icon="check-decagram-outline" onPress={save} loading={saving} />

      <Text variant="titleSmall" style={{ fontFamily: fontFamily.bold, marginTop: spacing.lg, marginBottom: spacing.sm }}>
        Check history
      </Text>
      {place.checks.length === 0 && <Text style={{ color: colors.muted }}>No checks yet.</Text>}
      {place.checks.map((c, i) => (
        <View key={c.id} style={[styles.history, i === 0 && { borderLeftColor: colors.success }]} testID={`editor-check-${c.id}`}>
          <Text style={{ fontFamily: fontFamily.semibold }}>
            {formatDate(c.checked_on)} · {METHOD_LABEL[c.method] ?? c.method}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.muted }}>
            {[c.checked_by_name, c.checked_with && `with ${c.checked_with}`, c.confirmed].filter(Boolean).join(" · ")}
          </Text>
        </View>
      ))}
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  addBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.md },
  photoCard: { width: 200, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm },
  photo: { width: "100%", height: 112, borderRadius: radius.sm, marginBottom: spacing.xs, backgroundColor: colors.surfaceVariant },
  history: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: spacing.sm, marginBottom: spacing.sm },
});
