// Routendienst für die Planung (nur auf dem Server, Schlüssel aus der env-Datei).
// Seit v2.40.00 GraphHopper (GRAPHHOPPER_API_KEY, Free-Tarif: privat, 500 Credits/Tag);
// OpenRouteService (ORS_API_KEY) bleibt als Ersatz, falls nur dessen Schlüssel da ist.
// Datenfluss: Start-/Zielkoordinaten bzw. der Suchtext gehen an den jeweiligen Dienst.

export type Dienst = "graphhopper" | "ors";
export type Point = { lat: number; lon: number };
export type Vorschlag = { label: string; lat: number; lon: number };

export function routingDienst(env: Record<string, string | undefined> = process.env): { dienst: Dienst; key: string } | null {
  if (env.GRAPHHOPPER_API_KEY) return { dienst: "graphhopper", key: env.GRAPHHOPPER_API_KEY };
  if (env.ORS_API_KEY) return { dienst: "ors", key: env.ORS_API_KEY };
  return null;
}

const LAENDER = new Set(["DE", "AT", "CH"]);

// --- Antworten auslesen (reine Funktionen, siehe routing.test.ts) ---

export function parseGraphHopperRoute(json: unknown): { km: number; minutes: number } | null {
  const p = (json as { paths?: { distance?: number; time?: number }[] })?.paths?.[0];
  if (!p || !Number.isFinite(p.distance)) return null;
  return { km: (p.distance as number) / 1000, minutes: Math.round((p.time ?? 0) / 60000) };
}

export function parseOrsRoute(json: unknown): { km: number; minutes: number } | null {
  const s = (json as { routes?: { summary?: { distance?: number; duration?: number } }[] })?.routes?.[0]?.summary;
  if (!s || !Number.isFinite(s.distance)) return null;
  return { km: (s.distance as number) / 1000, minutes: Math.round((s.duration ?? 0) / 60) };
}

type GhHit = {
  point?: { lat?: number; lng?: number };
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  countrycode?: string;
};

export function parseGraphHopperGeocode(json: unknown): Vorschlag[] {
  const hits = ((json as { hits?: GhHit[] })?.hits ?? []).filter((h) => !h.countrycode || LAENDER.has(h.countrycode.toUpperCase()));
  const out: Vorschlag[] = [];
  for (const h of hits) {
    const lat = h.point?.lat;
    const lon = h.point?.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const strasse = [h.street, h.housenumber].filter(Boolean).join(" ");
    const ort = [h.postcode, h.city].filter(Boolean).join(" ");
    // Bei Adressen ist der Name oft schon "Straße Nr" bzw. der Ort - doppelt nicht anzeigen
    const name = h.name && h.name !== strasse && h.name !== h.city ? h.name : "";
    const label = [name, strasse, ort].filter(Boolean).join(", ");
    if (label && !out.some((o) => o.label === label)) out.push({ label, lat: lat as number, lon: lon as number });
  }
  return out.slice(0, 5);
}

export function parseOrsGeocode(json: unknown): Vorschlag[] {
  const feats = (json as { features?: { properties?: { label?: string }; geometry?: { coordinates?: [number, number] } }[] })?.features ?? [];
  return feats
    .map((f) => ({ label: f.properties?.label ?? "", lon: f.geometry?.coordinates?.[0] as number, lat: f.geometry?.coordinates?.[1] as number }))
    .filter((r) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lon));
}

// --- Anfragen ---

export async function fetchRoute(d: { dienst: Dienst; key: string }, from: Point, to: Point): Promise<Response> {
  if (d.dienst === "graphhopper") {
    const url = new URL("https://graphhopper.com/api/1/route");
    url.searchParams.append("point", `${from.lat},${from.lon}`);
    url.searchParams.append("point", `${to.lat},${to.lon}`);
    url.searchParams.set("profile", "car");
    url.searchParams.set("calc_points", "false");
    url.searchParams.set("locale", "de");
    url.searchParams.set("key", d.key);
    return fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  }
  return fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: { Authorization: d.key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ coordinates: [[from.lon, from.lat], [to.lon, to.lat]] }),
    signal: AbortSignal.timeout(10_000),
  });
}

// near: Vorschläge zuerst in der Nähe (Start der Strecke bzw. letzter Ladeort)
export async function fetchGeocode(d: { dienst: Dienst; key: string }, q: string, near?: Point | null): Promise<Response> {
  if (d.dienst === "graphhopper") {
    const url = new URL("https://graphhopper.com/api/1/geocode");
    url.searchParams.set("q", q);
    url.searchParams.set("locale", "de");
    url.searchParams.set("limit", "8"); // danach auf DE/AT/CH gefiltert, 5 angezeigt
    if (near) url.searchParams.set("point", `${near.lat},${near.lon}`);
    url.searchParams.set("key", d.key);
    return fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  }
  const url = new URL("https://api.openrouteservice.org/geocode/autocomplete");
  url.searchParams.set("api_key", d.key);
  url.searchParams.set("text", q);
  url.searchParams.set("boundary.country", "DE,AT,CH");
  url.searchParams.set("size", "5");
  url.searchParams.set("lang", "de");
  if (near) {
    url.searchParams.set("focus.point.lat", String(near.lat));
    url.searchParams.set("focus.point.lon", String(near.lon));
  }
  return fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
}
