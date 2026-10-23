import { useMemo } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

import { buildPinMapHtml, parsePinMessage, PinMapProps } from "./pinMapHtml";

// Native (Android / iOS). The web build uses PinMap.web.tsx.
// The map is rebuilt only when `resetKey` changes, so dragging the pin doesn't reload it.
export function PinMap({ lat, lng, height = 260, onMove, resetKey }: PinMapProps & { resetKey: string }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildPinMapHtml(lat, lng), [resetKey]);
  return (
    <View testID="pin-map" style={{ height, borderRadius: 12, overflow: "hidden" }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://localhost" }}
        javaScriptEnabled
        nestedScrollEnabled
        onMessage={(e) => {
          const pin = parsePinMessage(e.nativeEvent.data);
          if (pin) onMove(pin.lat, pin.lng);
        }}
      />
    </View>
  );
}
