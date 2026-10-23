import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

import { formatDate, LANGUAGES } from "../../../src/admin";
import { AdminSection, ChoiceChips, FieldCell, FieldRow, Note, to } from "../../../src/adminUi";
import { auditLink, auditSentence, deleteConfirmed, displayName, ROLE_HINT, ROLE_NAME, ROLES, timeAgo, userState } from "../../../src/adminUsers";
import { adminApi } from "../../../src/api";
import { useAuth } from "../../../src/auth";
import { REPORT_STATUS_LABEL, TOPIC_LABEL } from "../../../src/reports";
import { capitalize, colors, fontFamily, radius, spacing } from "../../../src/theme";
import type { AdminUserDetail, AuditEntry, Role } from "../../../src/types";
import { Button, Empty, ErrorText, Input, Pill, SuccessText } from "../../../src/ui";

const FAITHS = ["jain", "hindu", "sikh", "muslim", "buddhist", "christian"];
const SECTS = ["digambar", "shvetambar"];

export default function UserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const [u, setU] = useState<AdminUserDetail | null>(null);
  const [name, setName] = useState("");
  const [faith, setFaith] = useState<string | null>(null);
  const [sect, setSect] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [role, setRole] = useState<Role>("pilgrim");
  const [lockReason, setLockReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const apply = useCallback((d: AdminUserDetail) => {
    setU(d);
    setName(d.name ?? "");
    setFaith(d.faith);
    setSect(d.sect);
    setLanguage(d.language || "en");
    setRole(d.role);
  }, []);

  useEffect(() => {
    adminApi
      .user(id)
      .then(apply)
      .catch((e) => setError(e.message));
  }, [apply, id]);

  useEffect(() => {
    if (u) navigation.setOptions({ title: displayName(u) });
  }, [navigation, u]);

  if (me?.role !== "admin") return <Empty icon="lock-outline" title="Admins only" />;
  if (!u)
    return error ? (
      <View style={styles.page}>
        <ErrorText testID="user-load-error">{error}</ErrorText>
      </View>
    ) : (
      <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
    );

  const isMe = u.id === me.id;
  const st = userState(u);
  const profileDirty =
    name.trim() !== (u.name ?? "") || faith !== u.faith || sect !== u.sect || language !== (u.language || "en") || role !== u.role;

  const run = async (key: string, fn: () => Promise<AdminUserDetail | void>, done: string) => {
    setError("");
    setMsg("");
    setBusy(key);
    try {
      const res = await fn();
      if (res) apply(res);
      setMsg(done);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  const saveProfile = () => {
    if (!name.trim()) return setError("Name cannot be empty.");
    const changes: Record<string, unknown> = {};
    if (name.trim() !== (u.name ?? "")) changes.name = name.trim();
    if (faith !== u.faith) changes.faith = faith;
    if (sect !== u.sect) changes.sect = sect;
    if (language !== (u.language || "en")) changes.language = language;
    if (role !== u.role) changes.role = role;
    run("profile", () => adminApi.updateUser(u.id, changes), "Profile saved");
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 240 }}>
          <Text testID="user-title" variant="headlineSmall">
            {displayName(u)}
            {isMe ? " (you)" : ""}
          </Text>
          <Text style={{ color: colors.muted }}>{[u.email, u.phone].filter(Boolean).join(" · ") || "No email or phone"}</Text>
          <View style={styles.pills}>
            <Pill testID="user-role" label={ROLE_NAME[u.role]} tone={u.role === "pilgrim" ? "neutral" : "primary"} />
            <Pill testID="user-state" label={st.label} tone={st.tone} />
          </View>
        </View>
        <View style={styles.stats}>
          <Stat label="Last login" value={timeAgo(u.last_login_at)} />
          <Stat label="Logins" value={String(u.login_count)} />
          <Stat label="Joined" value={formatDate(u.created_at)} />
          <Stat label="Saved places" value={String(u.saved_count)} />
          <Stat label="Reports" value={String(u.reports_count)} />
          <Stat label="Checks logged" value={String(u.checks_count)} />
        </View>
      </View>

      <ErrorText testID="user-error">{error}</ErrorText>
      <SuccessText testID="user-msg">{msg}</SuccessText>

      <AdminSection title="Login and access" testID="user-access">
        {u.is_locked && (
          <Note icon="lock-outline">
            Locked {timeAgo(u.locked_at)}: {u.locked_reason}. They cannot log in and were signed out of every device.
          </Note>
        )}
        {st.key === "blocked" && <Note icon="timer-sand">Too many wrong OTP codes. Login is blocked for a while; Reset login clears it now.</Note>}

        <Button
          testID="user-reset-login"
          title="Reset login"
          icon="lock-reset"
          variant="tonal"
          onPress={() => run("reset", () => adminApi.resetLogin(u.id), "Login reset: wrong-code block cleared and signed out of all devices")}
          loading={busy === "reset"}
        />
        <Text variant="bodySmall" style={{ color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.md }}>
          Clears any wrong-code block and signs them out everywhere. They log in again with a fresh OTP.
        </Text>

        {u.is_locked ? (
          <Button
            testID="user-unlock"
            title="Unlock account"
            icon="lock-open-variant-outline"
            variant="outline"
            onPress={() => run("unlock", () => adminApi.unlockUser(u.id), "Unlocked")}
            loading={busy === "unlock"}
          />
        ) : (
          !isMe && (
            <View>
              <Input testID="user-lock-reason" label="Reason for locking (kept in the log)" value={lockReason} onChangeText={setLockReason} />
              <Button
                testID="user-lock"
                title="Lock account"
                icon="lock-outline"
                variant="outline"
                disabled={lockReason.trim().length < 3}
                onPress={() =>
                  run("lock", async () => {
                    const d = await adminApi.lockUser(u.id, lockReason.trim());
                    setLockReason("");
                    return d;
                  }, "Locked and signed out")
                }
                loading={busy === "lock"}
              />
            </View>
          )
        )}
      </AdminSection>

      <AdminSection title="Profile and role" testID="user-profile">
        <Input testID="user-name" label="Name" value={name} onChangeText={setName} />
        <Text variant="labelLarge" style={styles.label}>
          Role
        </Text>
        {isMe ? (
          <Note>You cannot change your own role. Ask another admin.</Note>
        ) : (
          <>
            <ChoiceChips options={ROLES.map((r) => ({ value: r, label: ROLE_NAME[r] }))} value={role} onChange={setRole} testIDPrefix="user-role" />
            <Text variant="bodySmall" style={{ color: colors.muted, marginBottom: spacing.md }}>
              {ROLE_HINT[role]}
            </Text>
          </>
        )}
        <Text variant="labelLarge" style={styles.label}>
          Faith
        </Text>
        <ChoiceChips
          options={FAITHS.map((f) => ({ value: f, label: capitalize(f) }))}
          value={faith}
          onChange={(f) => {
            setFaith(f);
            if (f !== "jain") setSect(null);
          }}
          testIDPrefix="user-faith"
        />
        {faith === "jain" && (
          <>
            <Text variant="labelLarge" style={styles.label}>
              Sect
            </Text>
            <ChoiceChips options={SECTS.map((s) => ({ value: s, label: capitalize(s) }))} value={sect} onChange={setSect} testIDPrefix="user-sect" />
          </>
        )}
        <Text variant="labelLarge" style={styles.label}>
          App language
        </Text>
        <ChoiceChips options={LANGUAGES.slice(0, 4).map((l) => ({ value: l.code, label: l.label }))} value={language} onChange={setLanguage} testIDPrefix="user-language" />
        <Button testID="user-save" title="Save profile" icon="content-save-outline" onPress={saveProfile} disabled={!profileDirty} loading={busy === "profile"} />
      </AdminSection>

      <AdminSection title="Reports sent" testID="user-reports">
        {u.recent_reports.length === 0 ? (
          <Text style={{ color: colors.muted }}>No reports.</Text>
        ) : (
          u.recent_reports.map((r) => (
            <View key={r.id} style={styles.line}>
              <Text style={{ fontFamily: fontFamily.semibold }}>
                {r.kind === "new_place" ? `Missing place: ${r.place_title}` : `${r.place_title} · ${TOPIC_LABEL[r.topic]}`}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.muted }}>
                {formatDate(r.created_at)} · {REPORT_STATUS_LABEL[r.status]} · {r.message}
              </Text>
            </View>
          ))
        )}
      </AdminSection>

      <AdminSection title="Activity" hint="Changes made to this account, and what this person did in the admin section." testID="user-activity">
        <ActivityList title="Done to this account" entries={u.activity_on} onOpen={(link) => router.push(to(link))} />
        {u.role !== "pilgrim" && <ActivityList title="Done by this person" entries={u.activity_by} onOpen={(link) => router.push(to(link))} />}
        <Button testID="user-open-log" title="Open the full activity log" variant="text" onPress={() => router.push(to(`/admin/activity?actor=${u.id}`))} />
      </AdminSection>

      {!isMe && (
        <AdminSection title="Delete account" hint="Removes their name, email, phone and saved places. Reports they sent stay, without their name." testID="user-delete">
          <Note icon="alert-outline">This cannot be undone. Use it when the person asks for their data to be removed.</Note>
          <Input testID="user-delete-confirm" label="Type DELETE to confirm" value={typed} onChangeText={setTyped} autoCapitalize="characters" />
          <Button
            testID="user-delete"
            title="Delete this account"
            icon="delete-outline"
            variant="danger"
            disabled={!deleteConfirmed(typed)}
            loading={busy === "delete"}
            onPress={async () => {
              setError("");
              setBusy("delete");
              try {
                await adminApi.deleteUser(u.id);
                router.replace(to("/admin/users"));
              } catch (e: any) {
                setError(e.message);
                setBusy("");
              }
            }}
          />
        </AdminSection>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="bodySmall" style={{ color: colors.muted }}>
        {label}
      </Text>
      <Text style={{ fontFamily: fontFamily.semibold }}>{value || "—"}</Text>
    </View>
  );
}

function ActivityList({ title, entries, onOpen }: { title: string; entries: AuditEntry[]; onOpen: (link: string) => void }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text variant="labelLarge" style={{ marginBottom: spacing.xs }}>
        {title}
      </Text>
      {entries.length === 0 && <Text style={{ color: colors.muted }}>Nothing yet.</Text>}
      {entries.map((e) => {
        const link = auditLink(e);
        return (
          <Pressable key={e.id} disabled={!link} onPress={() => link && onOpen(link)} style={styles.line}>
            <Text>{auditSentence(e)}</Text>
            <Text variant="bodySmall" style={{ color: colors.muted }}>
              {timeAgo(e.created_at)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, flexBasis: 320, flexGrow: 1 },
  stat: { minWidth: 110 },
  label: { marginBottom: spacing.sm },
  line: { paddingVertical: spacing.xs + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
