import { ScrollView, View } from "react-native";
import { List, Text } from "react-native-paper";

import { colors, radius, spacing } from "../../src/theme";

// Placeholder FAQ. TODO(content): replace with reviewed answers.
const FAQ = [
  {
    q: "How does route search work?",
    a: "Enter where you start and where you are going. We draw the road route and list the places within your chosen detour distance.",
  },
  {
    q: "What does “Not yet verified” mean?",
    a: "We only mark a place verified after confirming its details by phone or a local reference. Until then, details may be incomplete.",
  },
  { q: "How do I log in without a password?", a: "Enter your email or mobile number and type the one-time code we send you." },
  { q: "Where are my yatras stored?", a: "On this device for now. Syncing across devices is planned." },
  { q: "How can I suggest a tirth or a correction?", a: "This will be available from the place page soon." },
];

export default function Help() {
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md }}>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
        <List.AccordionGroup>
          {FAQ.map((item, i) => (
            <List.Accordion key={i} id={String(i)} title={item.q} titleNumberOfLines={2} titleStyle={{ color: colors.text }}>
              <Text style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, color: colors.muted }}>{item.a}</Text>
            </List.Accordion>
          ))}
        </List.AccordionGroup>
      </View>
    </ScrollView>
  );
}
