import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { TILE_URL } from "./api";
import { buildMapHtml, parseMapMessage, RouteMapProps } from "./mapHtml";

// Native (Android / iOS). The web build uses RouteMap.web.tsx instead.
export function RouteMap({ route, places, height = 320, onSelectPlace }: RouteMapProps) {
  const html = useMemo(() => buildMapHtml({ route, places }, TILE_URL), [route, places]);

  return (
    <View testID="route-map" style={{ height, borderRadius: 12, overflow: "hidden" }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost" }}
        javaScriptEnabled
        nestedScrollEnabled
        onMessage={(e) => {
          const msg = parseMapMessage(e.nativeEvent.data);
          if (msg) onSelectPlace?.(msg.id);
        }}
      />
    </View>
  );
}
