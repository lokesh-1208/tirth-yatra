import { Stack } from "expo-router";
import { View } from "react-native";

import { useAuth } from "../../src/auth";
import { colors, fontFamily } from "../../src/theme";
import { Empty } from "../../src/ui";

/** Admin section: only curators get in. The backend checks the role on every call too. */
export default function AdminLayout() {
  const { user } = useAuth();
  if (user?.role !== "curator")
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
        <Empty testID="admin-forbidden" icon="lock-outline" title="Admin only" hint="This section is for Tirth Yatra curators." />
      </View>
    );
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fontFamily.bold, color: colors.text },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Admin" }} />
      <Stack.Screen name="places" options={{ title: "Places" }} />
      <Stack.Screen name="leads" options={{ title: "Leads to call" }} />
      <Stack.Screen name="reviews" options={{ title: "Review queue" }} />
      <Stack.Screen name="place/new" options={{ title: "Add a place" }} />
      <Stack.Screen name="place/[id]" options={{ title: "Edit place" }} />
    </Stack>
  );
}
