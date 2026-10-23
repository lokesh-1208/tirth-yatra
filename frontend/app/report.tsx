import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { to } from "../src/adminUi";
import { api } from "../src/api";
import { MESSAGE_MAX, reportProblem, ReportForm, TOPIC_LABEL, TOPICS, toReportInput } from "../src/reports";
import { colors, radius, spacing } from "../src/theme";
import { Button, Chip, ErrorText, Input } from "../src/ui";

/**
 * "Report wrong info" (with ?placeId=&placeName=) or "Missing a place?" (no placeId).
 * Reports go to the curators' review queue; nothing changes in the app until they check it.
 */
export default function ReportScreen() {
  const params = useLocalSearchParams<{ placeId?: string; placeName?: string; area?: string }>();
  const router = useRouter();
  const isCorrection = !!params.placeId;
  const [form, setForm] = useState<ReportForm>({
    kind: isCorrection ? "correction" : "new_place",
    placeId: params.placeId ? Number(params.placeId) : undefined,
    topic: "",
    message: "",
    placeName: "",
    area: params.area ?? "",
  });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (patch: Partial<ReportForm>) => setForm((f) => ({ ...f, ...patch }));

  const send = async () => {
    setError("");
    const problem = reportProblem(form);
    if (problem) return setError(problem);
    setSending(true);
    try {
      await api.sendReport(toReportInput(form));
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (sent)
    return (
      <View style={[styles.page, { alignItems: "center", paddingTop: spacing.xl }]} testID="report-sent">
        <View style={styles.doneIcon}>
          <MaterialCommunityIcons name="hands-pray" size={36} color={colors.success} />
        </View>
        <Text variant="titleLarge" style={{ textAlign: "center" }}>
          Thank you!
        </Text>
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.lg }}>
          Our team will check this by calling or visiting before anything changes in the app. You can follow it in My
          reports.
        </Text>
        <Button testID="report-my-reports" title="See my reports" variant="tonal" onPress={() => router.replace(to("/my-reports"))} />
        <Button testID="report-done" title="Done" variant="text" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text variant="headlineSmall" testID="report-title">
        {isCorrection ? "Report wrong info" : "Missing a place?"}
      </Text>
      <Text style={{ color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.lg }}>
        {isCorrection
          ? `Tell us what is wrong at ${params.placeName ?? "this place"}. We check every report before changing anything.`
          : "Tell us about a tirth, mandir or dharamshala we don’t show yet. We call or visit before adding it."}
      </Text>

      {isCorrection ? (
        <>
          <Text variant="labelLarge" style={{ marginBottom: spacing.sm }}>
            What is wrong?
          </Text>
          <View style={styles.chips}>
            {TOPICS.map((t) => (
              <Chip key={t} testID={`report-topic-${t}`} label={TOPIC_LABEL[t]} selected={form.topic === t} onPress={() => set({ topic: t })} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Input testID="report-place-name" label="Name of the place" value={form.placeName} onChangeText={(placeName) => set({ placeName })} />
          <Input testID="report-area" label="Town / district" value={form.area} onChangeText={(area) => set({ area })} />
        </>
      )}

      <Input
        testID="report-message"
        label={isCorrection ? "What should it say?" : "How to find it, and anything you know"}
        value={form.message}
        onChangeText={(message) => set({ message })}
        multiline
        maxLength={MESSAGE_MAX}
        style={{ minHeight: 110, backgroundColor: colors.card }}
      />
      <ErrorText testID="report-error">{error}</ErrorText>
      <Button testID="report-send" title="Send report" icon="send" onPress={send} loading={sending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 640, alignSelf: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, marginBottom: spacing.md },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
});
