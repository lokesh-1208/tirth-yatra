import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { colors } from "../../src/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const icon =
  (name: IconName, outline: IconName) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
    <Ionicons name={focused ? name : outline} size={size} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Explore", tabBarButtonTestID: "tab-explore", tabBarIcon: icon("compass", "compass-outline") }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: "Plan Route", tabBarButtonTestID: "tab-plan", tabBarIcon: icon("map", "map-outline") }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarButtonTestID: "tab-saved", tabBarIcon: icon("bookmark", "bookmark-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarButtonTestID: "tab-profile", tabBarIcon: icon("person", "person-outline") }}
      />
    </Tabs>
  );
}
