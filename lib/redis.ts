import { Redis } from "@upstash/redis";
import { REDIS_KEY } from "./constants";
import { defaultData, migrate } from "./data";
import type { AppData } from "./types";

// The Vercel Marketplace "Upstash for Redis" integration sets KV_REST_API_URL /
// KV_REST_API_TOKEN (legacy Vercel KV naming), not UPSTASH_REDIS_REST_URL/TOKEN.
const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

export async function getAppData(): Promise<AppData> {
  const existing = await redis.get<AppData>(REDIS_KEY);
  if (existing) return migrate(existing);
  const fresh = defaultData();
  await redis.set(REDIS_KEY, fresh);
  return fresh;
}

export type SetAppDataResult = { ok: true; data: AppData } | { ok: false; current: AppData };

// Optimistic concurrency: the caller must pass the _rev it last read. If
// someone else has saved in the meantime (current._rev !== expectedRev), the
// write is refused and the current (newer) data is returned instead of
// silently overwriting it - relevant because this household has two people
// who may have the app open on different devices at once.
//
// Not a true atomic compare-and-swap (there's a small window between the GET
// and the SET below where a second concurrent write could still slip through
// undetected) - Upstash's REST API has no WATCH/MULTI. For this app's real
// usage pattern (occasional saves from at most two people) that residual
// race is far better than the previous unconditional overwrite, and doesn't
// carry the risk of an untested Lua script in production.
export async function setAppData(data: AppData): Promise<SetAppDataResult> {
  const existing = await redis.get<AppData>(REDIS_KEY);
  const current = existing ? migrate(existing) : defaultData();
  if (current._rev !== data._rev) {
    return { ok: false, current };
  }
  const next = migrate({ ...data, _rev: current._rev + 1 });
  await redis.set(REDIS_KEY, next);
  return { ok: true, data: next };
}
