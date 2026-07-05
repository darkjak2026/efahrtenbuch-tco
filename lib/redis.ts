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

export async function setAppData(data: AppData): Promise<void> {
  await redis.set(REDIS_KEY, migrate(data));
}
