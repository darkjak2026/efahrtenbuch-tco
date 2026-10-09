import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { recordEvent } from "@/lib/monitoring";
import { fetchGeocode, parseGraphHopperGeocode, parseOrsGeocode, routingDienst } from "@/lib/routing";

// Adressvorschläge beim Tippen (Planung) über GraphHopper bzw. OpenRouteService.
// Ohne Schlüssel 503 - die App sucht dann erst auf "Suchen" direkt bei Nominatim
// (dessen Nutzungsregeln erlauben keine Vorschläge während des Tippens).
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = routingDienst();
  if (!d) return NextResponse.json({ error: "no-key" }, { status: 503 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ results: [] });
  // Optional: Nähe für die Reihenfolge der Vorschläge (keine Pflicht, nur gültige Koordinaten)
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lon = Number(req.nextUrl.searchParams.get("lon"));
  const near =
    req.nextUrl.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
      ? { lat, lon }
      : null;
  try {
    const res = await fetchGeocode(d, q, near);
    await recordEvent("api_aufruf", { dienst: d.dienst, art: "geocode", ok: res.ok });
    if (!res.ok) return NextResponse.json({ error: "geocode-failed" }, { status: 502 });
    const json = await res.json();
    return NextResponse.json({ results: d.dienst === "graphhopper" ? parseGraphHopperGeocode(json) : parseOrsGeocode(json) });
  } catch {
    return NextResponse.json({ error: "geocode-unreachable" }, { status: 502 });
  }
}
