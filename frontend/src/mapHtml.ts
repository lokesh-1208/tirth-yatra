import type { RoutePlace, RouteResult, RouteStop } from "./types";

export type MapPlace = Pick<RoutePlace, "id" | "name" | "latitude" | "longitude" | "verified" | "detour_km">;

export type RouteMapProps = {
  route: Pick<RouteResult, "geometry" | "start_point" | "end_point" | "source"> & { stops?: RouteStop[] };
  places: MapPlace[];
  height?: number;
  onSelectPlace?: (id: number) => void;
};

// Leaflet + OpenStreetMap tiles (no API key). Shared by the web (iframe) and native (WebView) maps.
// Messages to the host: {type: "open", id}.
export function buildMapHtml({ route, places }: Pick<RouteMapProps, "route" | "places">, tileUrl: string): string {
  // JSON inside <script>: escape "<" so a place name can never close the tag.
  const data = JSON.stringify({
    tiles: tileUrl,
    line: route.geometry,
    start: route.start_point,
    end: route.end_point,
    stops: (route.stops ?? []).map((st) => ({ label: st.label, lat: st.lat, lng: st.lng, km: st.distance_from_start_km })),
    straight: route.source !== "road",
    places: places.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.latitude,
      lng: p.longitude,
      verified: p.verified,
      detour: p.detour_km,
    })),
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html,body,#map{height:100%;margin:0;background:#f4efe6}
  .pin{width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)}
  .pin.place{background:#c2410c}.pin.unverified{background:#d6a05c}
  .pin.end{background:#15803d}.pin.start{background:#1d4ed8}.pin.stop{background:#b7791f;border-radius:4px;transform:none}
  .pop b{display:block;margin-bottom:2px}.pop a{color:#c2410c;font-weight:700;cursor:pointer}
  .note{position:absolute;z-index:1000;left:8px;bottom:8px;background:#fff;padding:3px 8px;border-radius:6px;font:12px sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.3)}
</style></head>
<body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var D = ${data};
  var map = L.map("map", {zoomControl:true, attributionControl:true});
  L.tileLayer(D.tiles, {maxZoom:18, attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
  function pin(cls){ return L.divIcon({className:"", html:'<div class="pin '+cls+'"></div>', iconSize:[22,22], iconAnchor:[11,22], popupAnchor:[0,-20]}); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function send(msg){
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else window.parent.postMessage(s, "*");
  }
  var line = L.polyline(D.line, {color:"#c2410c", weight:5, opacity:.85, dashArray: D.straight ? "8 8" : null}).addTo(map);
  L.marker([D.start.lat, D.start.lng], {icon:pin("start")}).addTo(map).bindPopup("<b>Start</b>"+esc(D.start.label));
  L.marker([D.end.lat, D.end.lng], {icon:pin("end")}).addTo(map).bindPopup("<b>Destination</b>"+esc(D.end.label));
  var bounds = line.getBounds();
  D.stops.forEach(function(s, i){
    L.marker([s.lat, s.lng], {icon:pin("stop")}).addTo(map).bindPopup("<b>Break journey "+(i+1)+"</b>"+esc(s.label)+"<br>"+s.km+" km from start");
    bounds.extend([s.lat, s.lng]);
  });
  D.places.forEach(function(p){
    var m = L.marker([p.lat, p.lng], {icon:pin(p.verified ? "place" : "place unverified")}).addTo(map);
    m.bindPopup('<div class="pop"><b>'+esc(p.name)+'</b>'+p.detour+' km from route<br><a data-id="'+p.id+'">View details</a></div>');
    bounds.extend([p.lat, p.lng]);
  });
  map.fitBounds(bounds, {padding:[30,30]});
  if (D.straight) { var n = document.createElement("div"); n.className="note"; n.textContent="Straight-line estimate (road route unavailable)"; document.body.appendChild(n); }
  document.addEventListener("click", function(e){
    var id = e.target && e.target.getAttribute && e.target.getAttribute("data-id");
    if (id) send({type:"open", id:Number(id)});
  });
</script></body></html>`;
}

export function parseMapMessage(raw: unknown): { type: "open"; id: number } | null {
  try {
    const m = typeof raw === "string" ? JSON.parse(raw) : raw;
    return m && m.type === "open" && Number.isFinite(m.id) ? { type: "open", id: m.id } : null;
  } catch {
    return null;
  }
}
