import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "./api";
import { colors, spacing } from "./theme";
import type { GeoPoint } from "./types";
import { Input } from "./ui";

type Props = {
  testID: string;
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Called with the chosen suggestion, or null when the user edits the text afterwards. */
  onPick: (point: GeoPoint | null) => void;
};

// Text field with place-name suggestions (backend /geocode -> Nominatim). Typing freely still works.
export function LocationInput({ testID, label, placeholder, value, onChangeText, onPick }: Props) {
  const [suggestions, setSuggestions] = useState<GeoPoint[]>([]);
  const justPicked = useRef(false);
  const seq = useRef(0);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await api.geocode(q);
        if (mine === seq.current) setSuggestions(res);
      } catch {
        if (mine === seq.current) setSuggestions([]);
      }
    }, 400); // debounce: the public geocoder allows ~1 request/second
    return () => clearTimeout(t);
  }, [value]);

  return (
    <View style={{ zIndex: 10 }}>
      <Input
        testID={testID}
        label={label}
        value={value}
        placeholder={placeholder}
        autoCorrect={false}
        onChangeText={(t) => {
          onPick(null);
          onChangeText(t);
        }}
      />
      {suggestions.length > 0 && (
        <View style={styles.list} testID={`${testID}-suggestions`}>
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.lat},${s.lng}`}
              testID={`${testID}-suggestion-${i}`}
              style={styles.item}
              onPress={() => {
                justPicked.current = true;
                setSuggestions([]);
                onChangeText(s.label);
                onPick(s);
              }}
            >
              <Text style={{ color: colors.text }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  item: { paddingVertical: 10, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
