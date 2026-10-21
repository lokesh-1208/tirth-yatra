import { useState } from "react";
import { ScrollView, View } from "react-native";
import { RadioButton, Text } from "react-native-paper";

import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, radius, spacing } from "../../src/theme";
import { ErrorText, Placeholder, SuccessText } from "../../src/ui";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
];

// Saves the preference on the account. TODO(i18n): translate UI strings and switch on user.language.
export default function LanguageSettings() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const choose = async (code: string) => {
    setError("");
    setMsg("");
    try {
      setUser(await api.updateMe({ language: code }));
      setMsg("Language saved");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.md }}>
      <ErrorText testID="language-error">{error}</ErrorText>
      <SuccessText testID="language-msg">{msg}</SuccessText>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
        <RadioButton.Group onValueChange={choose} value={user?.language ?? "en"}>
          {LANGUAGES.map((l) => (
            <RadioButton.Item key={l.code} testID={`language-${l.code}`} label={l.label} value={l.code} color={colors.primary} />
          ))}
        </RadioButton.Group>
      </View>
      <View style={{ height: spacing.md }} />
      <Placeholder text="Hindi translation of the app screens is in progress. Your choice is saved and will apply once it's ready." />
      <Text variant="bodySmall" style={{ color: colors.muted, marginTop: spacing.md }}>
        Place names are always shown as written locally.
      </Text>
    </ScrollView>
  );
}
