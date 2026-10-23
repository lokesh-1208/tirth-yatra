import {
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
  Mukta_800ExtraBold,
} from "@expo-google-fonts/mukta";
import { TiroDevanagariHindi_400Regular } from "@expo-google-fonts/tiro-devanagari-hindi";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { ActivityIndicator, PaperProvider } from "react-native-paper";

import { AuthProvider, useAuth } from "../src/auth";
import { colors, fontFamily, navTheme, paperTheme } from "../src/theme";
import { YatraProvider } from "../src/yatras";

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    if (!user && !inAuthGroup) router.replace("/login");
    else if (user && !user.name && !inOnboarding) router.replace("/onboarding");
    else if (user?.name && (inAuthGroup || inOnboarding)) router.replace("/");
  }, [user, loading, segments, router]);

  if (loading) return <Splash />;

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
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="place/[id]" options={{ title: "", headerTransparent: true, headerTintColor: "#fff", headerStyle: { backgroundColor: "transparent" } }} />
      <Stack.Screen name="yatra/[id]" options={{ title: "", headerTransparent: true, headerTintColor: "#fff", headerStyle: { backgroundColor: "transparent" } }} />
      <Stack.Screen name="settings/language" options={{ title: "Language" }} />
      <Stack.Screen name="settings/help" options={{ title: "Help & FAQ" }} />
      <Stack.Screen name="settings/about" options={{ title: "About Tirth Yatra" }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="report" options={{ title: "Report" }} />
      <Stack.Screen name="my-reports" options={{ title: "My reports" }} />
    </Stack>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Mukta_400Regular,
    Mukta_500Medium,
    Mukta_600SemiBold,
    Mukta_700Bold,
    Mukta_800ExtraBold,
    TiroDevanagariHindi_400Regular,
    ...MaterialCommunityIcons.font,
  });

  // If fonts fail to load (e.g. offline web), carry on with system fonts rather than block the app.
  const ready = fontsLoaded || !!fontError;

  return (
    <PaperProvider theme={paperTheme} settings={{ icon: (props) => <MaterialCommunityIcons {...(props as any)} /> }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style="dark" />
        {ready ? (
          <AuthProvider>
            <YatraProvider>
              <Gate />
            </YatraProvider>
          </AuthProvider>
        ) : (
          <Splash />
        )}
      </ThemeProvider>
    </PaperProvider>
  );
}
