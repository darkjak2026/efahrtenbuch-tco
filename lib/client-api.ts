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
