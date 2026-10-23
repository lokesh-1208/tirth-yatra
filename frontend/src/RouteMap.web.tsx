import { createElement, useEffect, useMemo } from "react";

import { TILE_URL } from "./api";
import { buildMapHtml, parseMapMessage, RouteMapProps } from "./mapHtml";

export function RouteMap({ route, places, height = 320, onSelectPlace }: RouteMapProps) {
  const html = useMemo(() => buildMapHtml({ route, places }, TILE_URL), [route, places]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = parseMapMessage(e.data);
      if (msg) onSelectPlace?.(msg.id);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSelectPlace]);

  return createElement("iframe", {
    "data-testid": "route-map",
    title: "Route map",
    srcDoc: html,
    // allow-scripts only: the map HTML is generated locally, but keep the frame isolated anyway.
    sandbox: "allow-scripts",
    style: { width: "100%", height, border: "1px solid #e5dccd", borderRadius: 12, display: "block" },
  });
}
