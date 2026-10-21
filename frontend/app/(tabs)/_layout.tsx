import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";

import { colors, fontFamily } from "../../src/theme";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const icon =
  (name: IconName, outline: IconName) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
    <MaterialCommunityIcons name={focused ? name : outline} size={size} color={color} />;

// Five tabs (the Material guideline maximum). Each screen draws its own hero header.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 10 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Explore", tabBarButtonTestID: "tab-explore", tabBarIcon: icon("compass", "compass-outline") }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: "Plan Route", tabBarButtonTestID: "tab-plan", tabBarIcon: icon("map-marker-path", "map-marker-path") }}
      />
      <Tabs.Screen
        name="yatras"
        options={{ title: "My Yatras", tabBarButtonTestID: "tab-yatras", tabBarIcon: icon("bag-personal", "bag-personal-outline") }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", tabBarButtonTestID: "tab-saved", tabBarIcon: icon("bookmark", "bookmark-outline") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarButtonTestID: "tab-profile", tabBarIcon: icon("account-circle", "account-circle-outline") }}
      />
    </Tabs>
  );
}
