import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

// Adressvorschläge beim Tippen (Planung) über OpenRouteService-Autocomplete.
// Ohne Schlüssel 503 - die App sucht dann erst auf "Suchen" direkt bei Nominatim
// (dessen Nutzungsregeln erlauben keine Vorschläge während des Tippens).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.ORS_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 503 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ results: [] });
  const url = new URL("https://api.openrouteservice.org/geocode/autocomplete");
  url.searchParams.set("api_key", key);
  url.searchParams.set("text", q);
  url.searchParams.set("boundary.country", "DE,AT,CH");
  url.searchParams.set("size", "5");
  url.searchParams.set("lang", "de");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!res.ok) return NextResponse.json({ error: "geocode-failed" }, { status: 502 });
    const json = await res.json();
    const results = (json?.features ?? [])
      .map((f: { properties?: { label?: string }; geometry?: { coordinates?: [number, number] } }) => ({
        label: f.properties?.label ?? "",
        lon: f.geometry?.coordinates?.[0],
        lat: f.geometry?.coordinates?.[1],
      }))
      .filter((r: { label: string; lat?: number; lon?: number }) => r.label && Number.isFinite(r.lat) && Number.isFinite(r.lon));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "geocode-unreachable" }, { status: 502 });
  }
}
