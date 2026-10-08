import type { AppData } from "./types";
import type { SetAppDataResult } from "./redis";

// Storage switch: on the own server (netcup) DATABASE_URL points at Postgres,
// on Vercel (until it is switched off) the Upstash Redis variables are set.
// Modules are loaded lazily so the Redis client is never created on netcup and
// the Postgres pool never on Vercel.

export const storageKind = (): "postgres" | "redis" => (process.env.DATABASE_URL ? "postgres" : "redis");

export async function getAppData(): Promise<AppData> {
  return storageKind() === "postgres" ? (await import("./pg-store")).getAppData() : (await import("./redis")).getAppData();
}

export async function setAppData(data: AppData): Promise<SetAppDataResult> {
  return storageKind() === "postgres"
    ? (await import("./pg-store")).setAppData(data)
    : (await import("./redis")).setAppData(data);
}
