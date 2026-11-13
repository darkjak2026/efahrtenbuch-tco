import type { AppData } from "./types";

// Dreiwege-Zusammenführung für zwei Geräte, die gleichzeitig speichern (v2.56.02).
//
// Der Server nimmt ein Speichern nur an, wenn die mitgeschickte Revision (_rev) noch die
// aktuelle ist. Früher wurde die Änderung des Geräts mit dem älteren Stand verworfen. Jetzt
// vergleicht die App drei Stände: den letzten vom Server bestätigten (base), den eigenen
// (local) und den neuen Serverstand (remote) - und führt beide Änderungen zusammen.
//
// - Listen (Ladevorgänge, Ladekarten, Wünsche …) werden als Mengen behandelt: neue und
//   gelöschte Einträge beider Seiten bleiben erhalten. Einträge haben keine Kennung, ein
//   geänderter Eintrag zählt als „alter gelöscht, neuer hinzugefügt“.
// - Einzelwerte: Hat nur eine Seite etwas geändert, gilt diese Änderung. Haben beide
//   dasselbe Feld verschieden geändert, gewinnt die eigene (jüngste) Änderung.
// - Die eigene Reihenfolge bleibt stabil, fremde Neuzugänge kommen ans Ende (die
//   Bearbeiten-Fenster adressieren Einträge über ihre Position in der Liste).

// Schlüsselreihenfolge ist egal (Postgres-jsonb sortiert Schlüssel um), undefined zählt als fehlend.
export function canon(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canon(o[k]))
      .join(",") +
    "}"
  );
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function withoutRev(d: AppData): Omit<AppData, "_rev"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _rev, ...rest } = d;
  return rest;
}

// Inhalt ohne Revisionsnummer als Vergleichstext: gleich = nichts Neues zu speichern.
export function contentKey(d: AppData): string {
  return canon(withoutRev(d));
}

function counts(arr: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const el of arr) {
    const k = canon(el);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

// Wie oft ein Eintrag nach der Zusammenführung vorkommen soll.
function wanted(b: number, l: number, r: number): number {
  if (l === b) return r; // eigene Seite unverändert
  if (r === b) return l; // andere Seite unverändert
  if (l === r) return l;
  if (l > b && r > b) return Math.max(l, r); // beide haben ihn hinzugefügt: derselbe Eintrag (z. B. wiederholtes Speichern)
  if (l < b && r < b) return Math.min(l, r); // beide haben ihn gelöscht
  return Math.max(0, l + r - b); // einer fügt hinzu, der andere löscht
}

function mergeArray(base: unknown[], local: unknown[], remote: unknown[], path: string, conflicts: string[]): unknown[] {
  const cb = counts(base);
  const cl = counts(local);
  const cr = counts(remote);
  const want = new Map<string, number>();
  let bothRemoved = false;
  let localAdded = false;
  let remoteAdded = false;
  for (const k of new Set([...cb.keys(), ...cl.keys(), ...cr.keys()])) {
    const b = cb.get(k) ?? 0;
    const l = cl.get(k) ?? 0;
    const r = cr.get(k) ?? 0;
    want.set(k, wanted(b, l, r));
    if (l < b && r < b) bothRemoved = true;
    if (l > b) localAdded = true;
    if (r > b) remoteAdded = true;
  }
  // Beide haben denselben Eintrag angefasst und je eine neue Fassung abgelegt: beide Fassungen bleiben, bitte prüfen.
  if (bothRemoved && localAdded && remoteAdded) conflicts.push(path || "(Wurzel)");
  const out: unknown[] = [];
  const used = new Map<string, number>();
  const take = (arr: unknown[]) => {
    for (const el of arr) {
      const k = canon(el);
      const have = used.get(k) ?? 0;
      if (have < (want.get(k) ?? 0)) {
        out.push(el);
        used.set(k, have + 1);
      }
    }
  };
  take(local);
  take(remote);
  return out;
}

function mergeValue(base: unknown, local: unknown, remote: unknown, path: string, conflicts: string[]): unknown {
  const cb = canon(base);
  const cl = canon(local);
  const cr = canon(remote);
  if (cl === cb) return remote; // hier nichts selbst geändert
  if (cr === cb) return local; // das andere Gerät hat hier nichts geändert
  if (cl === cr) return local; // beide gleich geändert
  if (Array.isArray(local) && Array.isArray(remote)) {
    return mergeArray(Array.isArray(base) ? base : [], local, remote, path, conflicts);
  }
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(local), ...Object.keys(remote)])) {
      const v = mergeValue(b[k], local[k], remote[k], path ? `${path}.${k}` : k, conflicts);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  // Dasselbe Feld auf beiden Seiten verschieden geändert: die eigene (jüngste) Änderung gewinnt.
  conflicts.push(path || "(Wurzel)");
  return local;
}

export interface MergeResult {
  data: AppData;
  // Stellen, an denen beide Seiten dasselbe geändert haben (die App weist darauf hin).
  conflicts: string[];
}

// base = zuletzt vom Server bestätigter Stand, local = eigener Stand, remote = aktueller Serverstand.
// Das Ergebnis trägt die Revision des Servers und kann direkt gespeichert werden.
export function mergeAppData(base: AppData, local: AppData, remote: AppData): MergeResult {
  const conflicts: string[] = [];
  const merged = mergeValue(withoutRev(base), withoutRev(local), withoutRev(remote), "", conflicts) as Omit<AppData, "_rev">;
  return { data: { ...merged, _rev: remote._rev } as AppData, conflicts };
}
