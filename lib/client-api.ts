"use client";

import { PIN_STORAGE_KEY } from "./constants";
import type { AppData } from "./types";

// localStorage can throw (strict private-browsing modes, blocked site data,
// storage quota) instead of just being empty - falling through to the PIN
// screen is fine, a hard crash on load is not.
export function getStoredPin(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storePin(pin: string): void {
  try {
    window.localStorage.setItem(PIN_STORAGE_KEY, pin);
  } catch {
    // Nothing we can do - the user will just have to re-enter the PIN next visit.
  }
}

export function clearStoredPin(): void {
  try {
    window.localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function fetchData(pin: string): Promise<{ ok: boolean; status: number; data?: AppData }> {
  const res = await fetch("/api/data", { headers: { "x-pin": pin } });
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as AppData;
  return { ok: true, status: res.status, data };
}

export type PostResult =
  | { ok: true; data: AppData }
  | { ok: false; conflict: true; data: AppData }
  | { ok: false; conflict: false };

// Result must always be checked by the caller - a silently ignored save
// failure (network drop, PIN expired, conflict) means a change looks saved
// in the UI while it never actually reached the household's real data.
export async function postData(pin: string, data: AppData): Promise<PostResult> {
  let res: Response;
  try {
    res = await fetch("/api/data", {
      method: "POST",
      headers: { "x-pin": pin, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    return { ok: false, conflict: false };
  }
  if (res.status === 409) {
    const body = (await res.json()) as { data: AppData };
    return { ok: false, conflict: true, data: body.data };
  }
  if (!res.ok) return { ok: false, conflict: false };
  const saved = (await res.json()) as AppData;
  return { ok: true, data: saved };
}

// --- Planung (Streckenrechner) ---
export interface GeoPoint {
  label: string;
  lat: number;
  lon: number;
}

export async function routeAvailable(pin: string): Promise<boolean> {
  try {
    const res = await fetch("/api/route", { headers: { "x-pin": pin } });
    return res.ok && (await res.json()).available === true;
  } catch {
    return false;
  }
}

export type RouteResult = { ok: true; km: number; minutes: number } | { ok: false; reason: "no-key" | "failed" };

export async function routeDistance(pin: string, from: GeoPoint, to: GeoPoint): Promise<RouteResult> {
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "x-pin": pin, "Content-Type": "application/json" },
      body: JSON.stringify({ from: { lat: from.lat, lon: from.lon }, to: { lat: to.lat, lon: to.lon } }),
    });
    if (res.status === 503) return { ok: false, reason: "no-key" };
    if (!res.ok) return { ok: false, reason: "failed" };
    const json = (await res.json()) as { km: number; minutes: number };
    return { ok: true, km: json.km, minutes: json.minutes };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

// Vorschläge beim Tippen (nur mit OpenRouteService-Schlüssel auf dem Server)
export async function suggestAddresses(pin: string, q: string): Promise<GeoPoint[]> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { headers: { "x-pin": pin } });
    if (!res.ok) return [];
    return ((await res.json()).results ?? []) as GeoPoint[];
  } catch {
    return [];
  }
}

// Einmalige Suche auf Knopfdruck direkt bei Nominatim (OpenStreetMap). Laut dessen
// Nutzungsregeln keine Vorschläge während des Tippens - deshalb nur auf "Suchen".
export async function searchAddresses(q: string): Promise<GeoPoint[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=de,at,ch&accept-language=de&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const list = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return list.map((r) => ({ label: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
  } catch {
    return [];
  }
}

// Luftlinie in km (Testmodus: grobe Straßenentfernung = Luftlinie × 1,25)
export function luftlinieKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
