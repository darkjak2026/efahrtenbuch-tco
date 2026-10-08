import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { recordEvent } from "@/lib/monitoring";

// Streckenrechner (Planung): Straßenentfernung über OpenRouteService. Der Schlüssel
// (ORS_API_KEY) liegt nur auf dem Server; die App fragt hier mit dem Haushalts-PIN an.
// Datenfluss: Start- und Zielkoordinaten gehen an OpenRouteService (Uni Heidelberg, EU).
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
  return NextResponse.json({ available: !!process.env.ORS_API_KEY });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.ORS_API_KEY;
  if (!key) return NextResponse.json({ error: "no-key" }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body || !isPoint(body.from) || !isPoint(body.to)) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ coordinates: [[body.from.lon, body.from.lat], [body.to.lon, body.to.lat]] }),
      signal: AbortSignal.timeout(10_000),
    });
    await recordEvent("api_aufruf", { dienst: "ors", art: "route", ok: res.ok });
    if (!res.ok) return NextResponse.json({ error: "route-failed", status: res.status }, { status: 502 });
    const json = await res.json();
    const summary = json?.routes?.[0]?.summary;
    if (!summary || !Number.isFinite(summary.distance)) return NextResponse.json({ error: "no-route" }, { status: 502 });
    return NextResponse.json({ km: summary.distance / 1000, minutes: Math.round((summary.duration ?? 0) / 60) });
  } catch {
    return NextResponse.json({ error: "route-unreachable" }, { status: 502 });
  }
}
