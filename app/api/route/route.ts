import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { recordEvent } from "@/lib/monitoring";
import { fetchRoute, parseGraphHopperRoute, parseOrsRoute, routingDienst } from "@/lib/routing";

// Streckenrechner (Planung): Straßenentfernung über GraphHopper (Ersatz: OpenRouteService),
// siehe lib/routing.ts. Der Schlüssel liegt nur auf dem Server; die App fragt hier mit dem
// Haushalts-PIN an. Datenfluss: Start- und Zielkoordinaten gehen an den Routendienst.
export const dynamic = "force-dynamic";

type Point = { lat: number; lon: number };
const isPoint = (p: unknown): p is Point =>
  !!p &&
  typeof p === "object" &&
  Number.isFinite((p as Point).lat) &&
  Number.isFinite((p as Point).lon) &&
  Math.abs((p as Point).lat) <= 90 &&
  Math.abs((p as Point).lon) <= 180;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = routingDienst();
  return NextResponse.json({ available: !!d, dienst: d?.dienst ?? null });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const d = routingDienst();
  if (!d) return NextResponse.json({ error: "no-key" }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body || !isPoint(body.from) || !isPoint(body.to)) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  try {
    const res = await fetchRoute(d, body.from, body.to);
    await recordEvent("api_aufruf", { dienst: d.dienst, art: "route", ok: res.ok });
    if (!res.ok) return NextResponse.json({ error: "route-failed", status: res.status }, { status: 502 });
    const json = await res.json();
    const r = d.dienst === "graphhopper" ? parseGraphHopperRoute(json) : parseOrsRoute(json);
    if (!r) return NextResponse.json({ error: "no-route" }, { status: 502 });
    return NextResponse.json({ ...r, dienst: d.dienst });
  } catch {
    return NextResponse.json({ error: "route-unreachable" }, { status: 502 });
  }
}
