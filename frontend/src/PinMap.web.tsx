import { createElement, useEffect, useMemo } from "react";

import { buildPinMapHtml, parsePinMessage, PinMapProps } from "./pinMapHtml";

// The map is rebuilt only when `resetKey` changes, so dragging the pin doesn't reload it.
export function PinMap({ lat, lng, height = 260, onMove, resetKey }: PinMapProps & { resetKey: string }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => buildPinMapHtml(lat, lng), [resetKey]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const pin = parsePinMessage(e.data);
      if (pin) onMove(pin.lat, pin.lng);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMove]);

  return createElement("iframe", {
    "data-testid": "pin-map",
    title: "Place location",
    srcDoc: html,
    sandbox: "allow-scripts",
    style: { width: "100%", height, border: "1px solid #e5dccd", borderRadius: 12, display: "block" },
  });
}
