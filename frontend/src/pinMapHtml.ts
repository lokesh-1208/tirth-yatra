// Leaflet map with one draggable pin, for setting a place's location in the admin editor.
// Shared by the web (iframe) and native (WebView) PinMap. Messages to the host: {type: "pin", lat, lng}.

export type PinMapProps = {
  lat: number | null;
  lng: number | null;
  height?: number;
  onMove: (lat: number, lng: number) => void;
};

// Centre of Madhya Pradesh when no pin is set yet.
const DEFAULT_CENTRE = { lat: 23.25, lng: 77.41 };

export function buildPinMapHtml(lat: number | null, lng: number | null, tileUrl: string): string {
  const has = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng);
  // JSON inside <script>: escape "<" so nothing can close the tag.
  const data = JSON.stringify({
    has,
    lat: has ? lat : DEFAULT_CENTRE.lat,
    lng: has ? lng : DEFAULT_CENTRE.lng,
    tiles: tileUrl,
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body,#map{height:100%;margin:0;background:#f4efe6}
  .pin{width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c2410c;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
  .hint{position:absolute;z-index:1000;left:8px;top:8px;background:#fff;padding:3px 8px;border-radius:6px;font:12px sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.3)}
</style></head>
<body><div id="map"></div><div class="hint">Tap the map or drag the pin to the mandir gate</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var D = ${data};
  var map = L.map("map").setView([D.lat, D.lng], D.has ? 16 : 7);
  L.tileLayer(D.tiles, {maxZoom:19, attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
  var icon = L.divIcon({className:"", html:'<div class="pin"></div>', iconSize:[26,26], iconAnchor:[13,26]});
  var marker = null;
  function send(ll){
    var s = JSON.stringify({type:"pin", lat: ll.lat, lng: ll.lng});
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.parent.postMessage(s, "*");
  }
  function place(ll){
    if (!marker) { marker = L.marker(ll, {icon:icon, draggable:true}).addTo(map); marker.on("dragend", function(){ send(marker.getLatLng()); }); }
    else marker.setLatLng(ll);
  }
  if (D.has) place([D.lat, D.lng]);
  map.on("click", function(e){ place(e.latlng); send(e.latlng); });
</script></body></html>`;
}

export function parsePinMessage(raw: unknown): { lat: number; lng: number } | null {
  try {
    const m = typeof raw === "string" ? JSON.parse(raw) : raw;
    return m && m.type === "pin" && Number.isFinite(m.lat) && Number.isFinite(m.lng) ? { lat: m.lat, lng: m.lng } : null;
  } catch {
    return null;
  }
}
