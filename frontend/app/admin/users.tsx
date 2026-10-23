import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator, Switch, Text } from "react-native-paper";

import { ChoiceChips, AdminSection, FieldCell, FieldRow, to } from "../../src/adminUi";
import { displayName, ROLE_HINT, ROLE_NAME, ROLES, timeAgo, userState } from "../../src/adminUsers";
import { adminApi } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, fontFamily, radius, spacing } from "../../src/theme";
import type { AdminUser, Role } from "../../src/types";
import { Button, Chip, Empty, ErrorText, Input, Pill } from "../../src/ui";

const PAGE = 50;
type Filter = "all" | Role | "locked" | "blocked";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "curator", label: "Curators" },
  { value: "pilgrim", label: "Pilgrims" },
  { value: "locked", label: "Locked" },
  { value: "blocked", label: "Login blocked" },
];

/** Master list of every account. Admins only. */
export default function Users() {
  const { user: me } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [hideTest, setHideTest] = useState(true);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // add a team member
  const [ident, setIdent] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("curator");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useCallback(
    (offset: number) => ({
      q: query || undefined,
      role: filter === "admin" || filter === "curator" || filter === "pilgrim" ? filter : undefined,
      state: filter === "locked" || filter === "blocked" ? filter : undefined,
      hide_test: hideTest || undefined,
      limit: PAGE,
      offset,
    }),
    [filter, query, hideTest]
  );

  const load = useCallback(async () => {
    setError("");
    try {
      const page = await adminApi.users(params(0));
      setUsers(page);
      setMore(page.length === PAGE);
    } catch (e: any) {
      setError(e.message);
    }
  }, [params]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadMore = async () => {
    if (!users || !more || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await adminApi.users(params(users.length));
      setUsers([...users, ...page]);
      setMore(page.length === PAGE);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const add = async () => {
    setAddError("");
    if (!ident.trim()) return setAddError("Enter their email or mobile number.");
    setAdding(true);
    try {
      const created = await adminApi.createUser({ identifier: ident.trim(), name: newName.trim() || undefined, role: newRole });
      setIdent("");
      setNewName("");
      router.push(to(`/admin/user/${created.id}`));
    } catch (e: any) {
      setAddError(e.message);
    } finally {
      setAdding(false);
    }
  };

  if (me?.role !== "admin")
    return <Empty testID="users-admin-only" icon="lock-outline" title="Admins only" hint="Ask an admin to manage users." />;

  return (
    <FlatList
      testID="admin-users-list"
      data={users ?? []}
      keyExtractor={(u) => String(u.id)}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      onEndReachedThreshold={0.4}
      onEndReached={loadMore}
      ListHeaderComponent={
        <View>
          <Text variant="headlineSmall">Users</Text>
          <Text style={{ color: colors.muted, marginBottom: spacing.md }}>
            Everyone who has logged in, plus team members you added. Tap someone to lock, reset their login, change their role or delete the account.
          </Text>

          <AdminSection title="Add a team member" hint="They log in with OTP on this email or phone, and get the role you choose." testID="users-add">
            <FieldRow>
              <FieldCell>
                <Input testID="users-add-identifier" label="Email or mobile number" value={ident} onChangeText={setIdent} />
              </FieldCell>
              <FieldCell>
                <Input testID="users-add-name" label="Name (optional)" value={newName} onChangeText={setNewName} />
              </FieldCell>
            </FieldRow>
            <ChoiceChips options={ROLES.map((r) => ({ value: r, label: ROLE_NAME[r] }))} value={newRole} onChange={setNewRole} testIDPrefix="users-add-role" />
            <Text variant="bodySmall" style={{ color: colors.muted, marginBottom: spacing.md }}>
              {ROLE_HINT[newRole]}
            </Text>
            <ErrorText testID="users-add-error">{addError}</ErrorText>
            <Button testID="users-add-save" title="Add user" icon="account-plus-outline" variant="tonal" onPress={add} loading={adding} />
          </AdminSection>

          <Input testID="users-search" label="Search name, email or phone" left="magnify" value={q} onChangeText={setQ} />
          <View style={styles.chips}>
            {FILTERS.map((f) => (
              <Chip key={f.value} testID={`users-filter-${f.value}`} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </View>
          <View style={styles.toggle}>
            <Switch testID="users-hide-test" value={hideTest} onValueChange={setHideTest} color={colors.primary} />
            <Text>Hide automated-test accounts</Text>
          </View>
          <ErrorText testID="users-error">{error}</ErrorText>
          {!users && !error && <ActivityIndicator color={colors.primary} />}
        </View>
      }
      renderItem={({ item }) => {
        const st = userState(item);
        return (
          <Pressable testID={`user-row-${item.id}`} style={styles.row} onPress={() => router.push(to(`/admin/user/${item.id}`))}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 16 }} numberOfLines={1}>
                {displayName(item)}
                {item.id === me?.id ? " (you)" : ""}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.muted }} numberOfLines={1}>
                {[item.email, item.phone].filter(Boolean).join(" · ")}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.muted }}>
                Last login {timeAgo(item.last_login_at)} · {item.login_count} login{item.login_count === 1 ? "" : "s"} · {item.reports_count} report
                {item.reports_count === 1 ? "" : "s"}
              </Text>
            </View>
            <View style={styles.pills}>
              <Pill testID={`user-role-${item.id}`} label={ROLE_NAME[item.role] ?? item.role} tone={item.role === "pilgrim" ? "neutral" : "primary"} />
              <Pill testID={`user-state-${item.id}`} label={st.label} tone={st.tone} />
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} /> : null}
      ListEmptyComponent={users ? <Empty testID="users-empty" icon="account-search-outline" title="No users found" /> : null}
    />
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 1000, alignSelf: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.sm },
  toggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pills: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
});
