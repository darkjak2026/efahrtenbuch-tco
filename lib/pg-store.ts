import { Pool } from "pg";
import { defaultData, migrate } from "./data";
import type { AppData } from "./types";
import type { SetAppDataResult } from "./redis";

// Postgres storage for the own server (netcup), active when DATABASE_URL is set.
// Same contract as lib/redis.ts: one document (the whole AppData) plus a revision
// counter. Unlike Upstash, Postgres can do a real compare-and-swap - the UPDATE
// only succeeds while the stored revision still equals the one the client read.

const DOC_ID = "main";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function db(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 30_000 });
  }
  return pool;
}

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db()
      .query(
        `CREATE TABLE IF NOT EXISTS app_data (
           id text PRIMARY KEY,
           doc jsonb NOT NULL,
           rev integer NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null; // next request tries again
        throw e;
      });
  }
  return schemaReady;
}

function withRev(doc: unknown, rev: number): AppData {
  const d = migrate(doc);
  d._rev = rev;
  return d;
}

export async function getAppData(): Promise<AppData> {
  await ensureSchema();
  const { rows } = await db().query<{ doc: unknown; rev: number }>("SELECT doc, rev FROM app_data WHERE id = $1", [DOC_ID]);
  if (rows.length) return withRev(rows[0].doc, rows[0].rev);
  const fresh = defaultData();
  await db().query("INSERT INTO app_data (id, doc, rev) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [
    DOC_ID,
    JSON.stringify(fresh),
    fresh._rev,
  ]);
  return getAppData();
}

export async function setAppData(data: AppData): Promise<SetAppDataResult> {
  await ensureSchema();
  const nextRev = data._rev + 1;
  const next = migrate({ ...data, _rev: nextRev });
  const { rowCount } = await db().query(
    "UPDATE app_data SET doc = $1, rev = $2, updated_at = now() WHERE id = $3 AND rev = $4",
    [JSON.stringify(next), nextRev, DOC_ID, data._rev]
  );
  if (rowCount === 1) return { ok: true, data: next };
  return { ok: false, current: await getAppData() };
}

// Shared pool for lib/monitoring.ts (metrics_history, ops_events).
export function pgPool(): Pool {
  return db();
}

// For /api/health: is the database reachable at all?
export async function pingDb(): Promise<void> {
  await db().query("SELECT 1");
}
