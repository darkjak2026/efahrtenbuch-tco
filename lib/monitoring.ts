import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pgPool } from "./pg-store";

// Monitoring – Metrics History (Bauplan Teil 3), nur mit Postgres (eigener Server).
// - ops_events: Ereignisse, die der Dienst selbst nicht messen kann bzw. darf:
//   Start (instrumentation.ts), Serverfehler (onRequestError), Aufrufe des
//   Routendienstes, und vom gemeinsamen Sicherungsskript backup_ok/backup_fehler
//   (der abgeschottete Dienst sieht den Sicherungsordner nicht).
// - metrics_history: ein Schnappschuss je Tag (systemd-Timer 23:50 und bei jedem
//   Deploy), nach 90 Tagen zu Monatswerten zusammengefasst; dazu einmalig aus der
//   Git-Historie rekonstruierte Komplexitätswerte (rekonstruiert = true).
// Komplexitätswerte (Codezeilen, Endpunkte, Abhängigkeiten) zählt der PC beim
// Deploy (scripts/komplexitaet.ts -> monitoring/*.json im Paket). Keine Geheimnisse.

export const RETENTION_TAGE = 90;
export const EVENTS = ["backend_start", "server_fehler", "api_aufruf", "backup_ok", "backup_fehler"] as const;
export type EventKind = (typeof EVENTS)[number];
const TZ = "Europe/Berlin";

export interface Kennzahlen {
  periode: string; // JJJJ-MM-TT (Berlin)
  erfasst_am: string;
  version: string | null;
  db_groesse_bytes: number;
  tabellen: number;
  eintraege_je_tabelle: Record<string, number>;
  ladevorgaenge: number;
  wuensche: number;
  orte: number;
  speichervorgaenge: number; // Zählnummer (rev) des Datensatzes
  datensatz_bytes: number;
  loc: number | null;
  dateien: number | null;
  endpunkte: number | null;
  abhaengigkeiten: number | null;
  uptime_sekunden: number | null;
  starts: number;
  fehler: number;
  api_aufrufe: number;
  backup_ok: boolean | null;
  backup_zeit: string | null;
}

export interface Snapshot extends Omit<Kennzahlen, "erfasst_am" | "eintraege_je_tabelle"> {
  art: "tag" | "monat";
  rekonstruiert: boolean;
}

let schemaReady: Promise<void> | null = null;

export function ensureMonitoringSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pgPool()
      .query(
        `CREATE TABLE IF NOT EXISTS ops_events (
           id bigserial PRIMARY KEY,
           at timestamptz NOT NULL DEFAULT now(),
           kind text NOT NULL,
           detail jsonb
         );
         CREATE INDEX IF NOT EXISTS ops_events_kind_at ON ops_events (kind, at);
         CREATE TABLE IF NOT EXISTS metrics_history (
           periode date NOT NULL,
           art text NOT NULL CHECK (art IN ('tag', 'monat')),
           rekonstruiert boolean NOT NULL DEFAULT false,
           erfasst_am timestamptz NOT NULL DEFAULT now(),
           version text,
           db_groesse_bytes bigint,
           tabellen integer,
           eintraege_je_tabelle jsonb,
           ladevorgaenge integer,
           wuensche integer,
           orte integer,
           speichervorgaenge integer,
           datensatz_bytes integer,
           loc integer,
           dateien integer,
           endpunkte integer,
           abhaengigkeiten integer,
           uptime_sekunden bigint,
           starts integer,
           fehler integer,
           api_aufrufe integer,
           backup_ok boolean,
           backup_zeit timestamptz,
           PRIMARY KEY (art, periode, rekonstruiert)
         )`
      )
      .then(() => undefined)
      .catch((e) => {
        schemaReady = null;
        throw e;
      });
  }
  return schemaReady;
}

// Ereignis melden; ein Fehler dabei darf nie eine Anfrage oder den Start stören.
export async function recordEvent(kind: EventKind, detail?: Record<string, unknown>): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await ensureMonitoringSchema();
    await pgPool().query("INSERT INTO ops_events (kind, detail) VALUES ($1, $2)", [kind, detail ? JSON.stringify(detail) : null]);
  } catch {
    // Monitoring ist Beiwerk
  }
}

// Instanz: "dienst" (Port 8020) oder "probe" (Probelauf beim Deploy, Port 8021)
export function instanz(): string {
  return process.env.EFB_INSTANZ || "dienst";
}

function leseJson<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "monitoring", name), "utf8")) as T;
  } catch {
    return null; // lokal bzw. ohne Deploy-Zählung
  }
}

type KomplexitaetDatei = { version: string | null; loc: number; dateien: number; endpunkte: number; abhaengigkeiten: number };

export async function collect(): Promise<Kennzahlen> {
  await ensureMonitoringSchema();
  const db = pgPool();
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0] as T;

  const { tag } = await one<{ tag: string }>("SELECT to_char((now() AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS tag", [TZ]);
  const tabellen = (
    await db.query<{ t: string }>("SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
  ).rows.map((r) => r.t);
  const eintraege: Record<string, number> = {};
  for (const t of tabellen) {
    eintraege[t] = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM public."${t.replace(/"/g, '""')}"`)).n);
  }
  const doc = await one<{ ladevorgaenge: string; wuensche: string; orte: string; rev: number; bytes: string } | undefined>(
    `SELECT
       (SELECT count(*) FROM jsonb_each(a.doc->'months') m(k, v), jsonb_array_elements(CASE WHEN jsonb_typeof(m.v) = 'array' THEN m.v ELSE '[]'::jsonb END) e
         WHERE COALESCE(e->>'datum', '') <> '') AS ladevorgaenge,
       COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(a.doc->'featureRequests') = 'array' THEN a.doc->'featureRequests' END), 0) AS wuensche,
       COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(a.doc->'places') = 'array' THEN a.doc->'places' END), 0) AS orte,
       a.rev, octet_length(a.doc::text) AS bytes
     FROM app_data a WHERE a.id = 'main'`
  ).catch(() => undefined);
  // Tagesfenster in Berliner Zeit
  const fenster = "at >= ((now() AT TIME ZONE $1)::date)::timestamp AT TIME ZONE $1";
  const ev = await one<{ fehler: string; starts: string; api: string }>(
    `SELECT count(*) FILTER (WHERE kind = 'server_fehler') AS fehler,
            count(*) FILTER (WHERE kind = 'backend_start' AND detail->>'instanz' = 'dienst') AS starts,
            count(*) FILTER (WHERE kind = 'api_aufruf') AS api
     FROM ops_events WHERE ${fenster}`,
    [TZ]
  );
  const start = await one<{ s: string | null }>(
    "SELECT EXTRACT(EPOCH FROM now() - max(at))::bigint AS s FROM ops_events WHERE kind = 'backend_start' AND detail->>'instanz' = 'dienst'"
  );
  const backup = await one<{ kind: string; at: Date } | undefined>(
    "SELECT kind, at FROM ops_events WHERE kind IN ('backup_ok', 'backup_fehler') ORDER BY at DESC LIMIT 1"
  );
  const k = leseJson<KomplexitaetDatei>("komplexitaet.json");
  const size = await one<{ b: string }>("SELECT pg_database_size(current_database()) AS b");
  return {
    periode: tag,
    erfasst_am: new Date().toISOString(),
    version: k?.version ?? null,
    db_groesse_bytes: Number(size.b),
    tabellen: tabellen.length,
    eintraege_je_tabelle: eintraege,
    ladevorgaenge: Number(doc?.ladevorgaenge ?? 0),
    wuensche: Number(doc?.wuensche ?? 0),
    orte: Number(doc?.orte ?? 0),
    speichervorgaenge: doc?.rev ?? 0,
    datensatz_bytes: Number(doc?.bytes ?? 0),
    loc: k?.loc ?? null,
    dateien: k?.dateien ?? null,
    endpunkte: k?.endpunkte ?? null,
    abhaengigkeiten: k?.abhaengigkeiten ?? null,
    uptime_sekunden: start.s === null ? null : Number(start.s),
    starts: Number(ev.starts),
    fehler: Number(ev.fehler),
    api_aufrufe: Number(ev.api),
    backup_ok: backup ? backup.kind === "backup_ok" : null,
    backup_zeit: backup ? backup.at.toISOString() : null,
  };
}

const COLS = [
  "version", "db_groesse_bytes", "tabellen", "eintraege_je_tabelle", "ladevorgaenge", "wuensche", "orte",
  "speichervorgaenge", "datensatz_bytes", "loc", "dateien", "endpunkte", "abhaengigkeiten", "uptime_sekunden",
  "starts", "fehler", "api_aufrufe", "backup_ok", "backup_zeit",
] as const;

// Schnappschuss des heutigen Tages (überschreibt einen vom selben Tag), danach
// rekonstruierte Werte nachtragen (nur einmal je Tag) und Retention anwenden.
export async function snapshot(): Promise<Kennzahlen> {
  const m = await collect();
  const db = pgPool();
  const values = COLS.map((c) => (c === "eintraege_je_tabelle" ? JSON.stringify(m[c]) : m[c]));
  await db.query(
    `INSERT INTO metrics_history (periode, art, rekonstruiert, ${COLS.join(", ")})
     VALUES ($1, 'tag', false, ${COLS.map((_, i) => `$${i + 2}`).join(", ")})
     ON CONFLICT (art, periode, rekonstruiert) DO UPDATE SET erfasst_am = now(), ${COLS.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`,
    [m.periode, ...values]
  );
  const rek = leseJson<(KomplexitaetDatei & { periode: string })[]>("rekonstruktion.json") ?? [];
  for (const r of rek) {
    await db.query(
      `INSERT INTO metrics_history (periode, art, rekonstruiert, version, loc, dateien, endpunkte, abhaengigkeiten)
       VALUES ($1, 'tag', true, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
      [r.periode, r.version, r.loc, r.dateien, r.endpunkte, r.abhaengigkeiten]
    );
  }
  await applyRetention();
  return m;
}

// Tageswerte älter als 90 Tage -> ein Monatswert je Monat (Bestandsgrößen vom
// jüngsten Tag, Zählwerte summiert; ein schon angelegter Monatswert wird ergänzt).
// Ereignisse älter als 90 Tage entfallen.
export async function applyRetention(): Promise<void> {
  const client = await pgPool().connect();
  const last = (c: string) => `(array_agg(${c} ORDER BY periode DESC))[1]`;
  const bestand = ["version", "db_groesse_bytes", "tabellen", "eintraege_je_tabelle", "ladevorgaenge", "wuensche", "orte", "speichervorgaenge", "datensatz_bytes", "loc", "dateien", "endpunkte", "abhaengigkeiten"];
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO metrics_history (periode, art, rekonstruiert, ${bestand.join(", ")}, uptime_sekunden, starts, fehler, api_aufrufe, backup_ok, backup_zeit)
       SELECT date_trunc('month', periode)::date, 'monat', rekonstruiert, ${bestand.map(last).join(", ")},
              max(uptime_sekunden), sum(starts), sum(fehler), sum(api_aufrufe), bool_and(backup_ok), max(backup_zeit)
       FROM metrics_history
       WHERE art = 'tag' AND periode < current_date - ${RETENTION_TAGE}
       GROUP BY date_trunc('month', periode), rekonstruiert
       ON CONFLICT (art, periode, rekonstruiert) DO UPDATE SET
         ${bestand.map((c) => `${c} = COALESCE(EXCLUDED.${c}, metrics_history.${c})`).join(", ")},
         uptime_sekunden = GREATEST(metrics_history.uptime_sekunden, EXCLUDED.uptime_sekunden),
         starts = COALESCE(metrics_history.starts, 0) + COALESCE(EXCLUDED.starts, 0),
         fehler = COALESCE(metrics_history.fehler, 0) + COALESCE(EXCLUDED.fehler, 0),
         api_aufrufe = COALESCE(metrics_history.api_aufrufe, 0) + COALESCE(EXCLUDED.api_aufrufe, 0),
         backup_ok = metrics_history.backup_ok AND EXCLUDED.backup_ok,
         backup_zeit = GREATEST(metrics_history.backup_zeit, EXCLUDED.backup_zeit)`
    );
    await client.query(`DELETE FROM metrics_history WHERE art = 'tag' AND periode < current_date - ${RETENTION_TAGE}`);
    await client.query(`DELETE FROM ops_events WHERE at < now() - interval '${RETENTION_TAGE} days'`);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function history(): Promise<Snapshot[]> {
  await ensureMonitoringSchema();
  const { rows } = await pgPool().query(
    `SELECT to_char(periode, 'YYYY-MM-DD') AS periode, art, rekonstruiert, ${COLS.filter((c) => c !== "eintraege_je_tabelle").join(", ")}
     FROM metrics_history ORDER BY periode, rekonstruiert DESC`
  );
  return rows.map((r) => ({
    ...r,
    db_groesse_bytes: r.db_groesse_bytes === null ? null : Number(r.db_groesse_bytes),
    uptime_sekunden: r.uptime_sekunden === null ? null : Number(r.uptime_sekunden),
    backup_zeit: r.backup_zeit ? new Date(r.backup_zeit).toISOString() : null,
  })) as Snapshot[];
}
