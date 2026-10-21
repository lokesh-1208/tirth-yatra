import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import Constants from "expo-constants";
import { ScrollView, View } from "react-native";
import { Text } from "react-native-paper";

import { colors, radius, spacing } from "../../src/theme";
import { Placeholder, SectionHeader } from "../../src/ui";

export default function About() {
  const version = Constants.expoConfig?.version ?? "dev";
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ alignItems: "center", padding: spacing.lg, backgroundColor: colors.primaryLight, borderRadius: radius.lg }}>
        <MaterialCommunityIcons name="hands-pray" size={48} color={colors.primary} />
        <Text variant="headlineSmall" style={{ color: colors.primaryDark, marginTop: spacing.sm }}>
          Tirth Yatra
        </Text>
        <Text testID="about-version" style={{ color: colors.muted }}>
          Version {version}
        </Text>
      </View>
      <SectionHeader title="Our purpose" />
      <Text style={{ color: colors.text, lineHeight: 22 }}>
        Tirth Yatra helps pilgrims discover holy places along their journey, starting with Jain tirths, and plan a yatra stop by stop.
      </Text>
      <SectionHeader title="Data & verification" />
      <Placeholder text="Information on how place details are collected and verified will be added here." />
      <SectionHeader title="Privacy" />
      <Placeholder text="Privacy policy to be added before public release." />
    </ScrollView>
  );
}
