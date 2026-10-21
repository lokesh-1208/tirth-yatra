import { DefaultTheme as NavDefaultTheme, Theme as NavTheme } from "@react-navigation/native";
import { configureFonts, MD3LightTheme, MD3Theme } from "react-native-paper";

/**
 * Brand palette, inspired by the Jain flag: saffron (primary), deep blue (secondary), gold (tertiary).
 * Change colours here only; every screen reads them from this file or from the Paper theme.
 */
export const colors = {
  primary: "#C2410C", // saffron
  primaryDark: "#9A3412",
  primaryLight: "#FFEDD5",
  secondary: "#1E3A8A", // deep blue
  secondaryLight: "#DBEAFE",
  gold: "#B7791F",
  goldLight: "#FEF3C7",
  bg: "#FFFBF5", // warm cream
  card: "#FFFFFF",
  surfaceVariant: "#F7EEE3",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#EADFD2",
  danger: "#B91C1C",
  dangerLight: "#FEE2E2",
  success: "#15803D",
  successLight: "#DCFCE7",
  warnBg: "#FEF3C7",
  warnText: "#92400E",
};

/** Saffron → gold gradient used on hero headers. */
export const heroGradient = ["#9A3412", "#C2410C", "#D97706"] as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 28 };

/** Font family names, as registered with useFonts() in app/_layout.tsx. */
export const fontFamily = {
  regular: "Mukta_400Regular",
  medium: "Mukta_500Medium",
  semibold: "Mukta_600SemiBold",
  bold: "Mukta_700Bold",
  extrabold: "Mukta_800ExtraBold",
  display: "TiroDevanagariHindi_400Regular", // serif, used for big titles and place names
};

// Every variant gets Mukta; headlines and display text get the Devanagari serif.
const base = configureFonts({ config: { fontFamily: fontFamily.regular } });
const withFamily = (family: string, weight: "400" | "500" | "600" | "700" = "400") => ({ fontFamily: family, fontWeight: weight });
const fonts: MD3Theme["fonts"] = {
  ...base,
  displayLarge: { ...base.displayLarge, ...withFamily(fontFamily.display) },
  displayMedium: { ...base.displayMedium, ...withFamily(fontFamily.display) },
  displaySmall: { ...base.displaySmall, ...withFamily(fontFamily.display) },
  headlineLarge: { ...base.headlineLarge, ...withFamily(fontFamily.display) },
  headlineMedium: { ...base.headlineMedium, ...withFamily(fontFamily.display) },
  headlineSmall: { ...base.headlineSmall, ...withFamily(fontFamily.display) },
  titleLarge: { ...base.titleLarge, ...withFamily(fontFamily.bold) },
  titleMedium: { ...base.titleMedium, ...withFamily(fontFamily.semibold) },
  titleSmall: { ...base.titleSmall, ...withFamily(fontFamily.semibold) },
  labelLarge: { ...base.labelLarge, ...withFamily(fontFamily.semibold) },
  labelMedium: { ...base.labelMedium, ...withFamily(fontFamily.semibold) },
  labelSmall: { ...base.labelSmall, ...withFamily(fontFamily.semibold) },
};

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 4,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: "#FFFFFF",
    primaryContainer: colors.primaryLight,
    onPrimaryContainer: colors.primaryDark,
    secondary: colors.secondary,
    onSecondary: "#FFFFFF",
    secondaryContainer: colors.secondaryLight,
    onSecondaryContainer: colors.secondary,
    tertiary: colors.gold,
    onTertiary: "#FFFFFF",
    tertiaryContainer: colors.goldLight,
    onTertiaryContainer: "#78350F",
    background: colors.bg,
    onBackground: colors.text,
    surface: colors.card,
    onSurface: colors.text,
    surfaceVariant: colors.surfaceVariant,
    onSurfaceVariant: colors.muted,
    outline: "#D6C7B5",
    outlineVariant: colors.border,
    error: colors.danger,
    errorContainer: colors.dangerLight,
    elevation: {
      level0: "transparent",
      level1: "#FFF8F0",
      level2: "#FFF4E8",
      level3: "#FFF0E0",
      level4: "#FFEEDC",
      level5: "#FFEBD6",
    },
  },
};

/** Keeps React Navigation headers and tab bars in step with the Paper theme. */
export const navTheme: NavTheme = {
  ...NavDefaultTheme,
  colors: {
    ...NavDefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
  },
};

export const KIND_LABEL: Record<string, string> = {
  tirth: "Tirth",
  atishay_kshetra: "Atishay Kshetra",
  temple: "Temple",
  dharamshala: "Dharamshala",
};

/** MaterialCommunityIcons name per place kind. */
export const KIND_ICON: Record<string, string> = {
  tirth: "meditation",
  atishay_kshetra: "star-four-points",
  temple: "flag-variant",
  dharamshala: "bed",
};

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
