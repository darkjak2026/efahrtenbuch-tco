import { test } from "node:test";
import assert from "node:assert/strict";
import { SaveSync, type SyncDeps } from "./saveSync";
import { defaultData, emptyRow } from "./data";
import { migrate } from "./data";
import type { PostResult } from "./client-api";
import type { AppData, ChargeRow } from "./types";

// v2.56.02: Speicher-Ablauf mit einem nachgebauten Server (gleiche Regel wie lib/pg-store.ts:
// speichern gelingt nur, wenn die mitgeschickte Revision noch die aktuelle ist).

const M = "2026-11";
const row = (datum: string, fahrzeug: "b10" | "t03", km: string): ChargeRow => ({ ...emptyRow(), datum, fahrzeug, km });
const eintraege = (d: AppData) => d.months[M].filter((r) => r.datum).map((r) => `${r.fahrzeug}:${r.km}`);
const tick = () => new Promise<void>((r) => setImmediate(r));

function fakeServer(opts: { manual?: boolean; normalize?: (d: AppData) => AppData } = {}) {
  let doc: AppData = { ...defaultData(), _rev: 0 };
  const antworten: Array<() => void> = [];
  let posts = 0;
  const holen = (): AppData => structuredClone(doc);
  const post = (data: AppData): Promise<PostResult> => {
    posts += 1;
    let res: PostResult;
    if (data._rev !== doc._rev) {
      res = { ok: false, conflict: true, data: holen() };
    } else {
      const next = migrate({ ...structuredClone(data), _rev: doc._rev + 1 });
      doc = opts.normalize ? opts.normalize(next) : next;
      res = { ok: true, data: holen() };
    }
    if (!opts.manual) return Promise.resolve(res);
    return new Promise((resolve) => antworten.push(() => resolve(res)));
  };
  return { holen, post, anzahl: () => posts, antwort: () => antworten.shift()?.() };
}

function client(srv: ReturnType<typeof fakeServer>, extra: Partial<SyncDeps> = {}) {
  const meldungen: string[] = [];
  const log = { aufgegeben: 0, angezeigt: 0 };
  const sync = new SaveSync(
    {
      post: (_pin, d) => srv.post(d),
      onData: () => {
        log.angezeigt += 1;
      },
      notify: (m) => meldungen.push(m),
      onGiveUp: () => {
        log.aufgegeben += 1;
      },
      ...extra,
    },
    srv.holen()
  );
  sync.load(srv.holen());
  sync.setEnabled(true);
  return { sync, meldungen, log };
}

test("einfaches Speichern: der Server hat den Eintrag, der Client gilt als sauber", async () => {
  const srv = fakeServer();
  const { sync } = client(srv);
  assert.equal(sync.isClean(), true);
  sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "2900")));
  assert.equal(sync.isClean(), false);
  await sync.flush();
  assert.deepEqual(eintraege(srv.holen()), ["b10:2900"]);
  assert.equal(sync.isClean(), true);
  assert.equal(srv.holen()._rev, 1);
});

test("Änderung während eines laufenden Speicherns geht nicht verloren", async () => {
  const srv = fakeServer({ manual: true });
  const { sync, meldungen } = client(srv);
  sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "2900")));
  const p = sync.flush();
  await tick(); // Speichern 1 ist unterwegs
  sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "3000"))); // während der Wartezeit
  srv.antwort(); // Antwort 1 kommt an
  await tick();
  srv.antwort(); // Antwort 2 (die Folgerunde mit der neuen Revision)
  await p;
  assert.deepEqual(eintraege(srv.holen()), ["b10:2900", "b10:3000"]);
  assert.equal(sync.isClean(), true);
  assert.deepEqual(meldungen, []); // kein falscher Konflikt
  assert.equal(srv.anzahl(), 2);
});

test("zwei gleichzeitig angestoßene Speichern stoßen sich nicht selbst ab", async () => {
  const srv = fakeServer({ manual: true });
  const { sync, meldungen } = client(srv);
  sync.edit((d) => d.months[M].push(row("2026-11-13", "b10", "3000")));
  const p1 = sync.flush();
  sync.edit((d) => d.months[M].push(row("2026-11-13", "b10", "3050")));
  const p2 = sync.flush(); // läuft schon: kehrt sofort zurück
  await tick();
  srv.antwort();
  await tick();
  srv.antwort();
  await Promise.all([p1, p2]);
  assert.deepEqual(eintraege(srv.holen()), ["b10:3000", "b10:3050"]);
  assert.deepEqual(meldungen, []);
});

test("zwei Geräte speichern nacheinander mit altem Stand: beide Einträge bleiben", async () => {
  const srv = fakeServer();
  const A = client(srv);
  const B = client(srv); // beide haben Revision 0
  A.sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "2900")));
  B.sync.edit((d) => d.months[M].push(row("2026-11-12", "t03", "12100")));
  await A.sync.flush();
  await B.sync.flush(); // Konflikt, wird zusammengeführt und erneut gespeichert
  assert.deepEqual(eintraege(srv.holen()).sort(), ["b10:2900", "t03:12100"]);
  assert.equal(B.sync.isClean(), true);
  assert.deepEqual(eintraege(B.sync.current).sort(), ["b10:2900", "t03:12100"]);
  assert.equal(B.meldungen[0], "Änderungen eines anderen Geräts übernommen");
  // A hat die Änderung von B noch nicht gesehen, bekommt sie beim Nachladen
  assert.deepEqual(eintraege(A.sync.current), ["b10:2900"]);
  assert.equal(A.sync.adoptRemote(srv.holen()), true);
  assert.deepEqual(eintraege(A.sync.current).sort(), ["b10:2900", "t03:12100"]);
});

test("beide ändern dasselbe Feld: die eigene Änderung gilt, es gibt den Hinweis zum Prüfen", async () => {
  const srv = fakeServer();
  const A = client(srv);
  const B = client(srv);
  A.sync.edit((d) => (d.vehicles.b10.leasing = "300"));
  B.sync.edit((d) => (d.vehicles.b10.leasing = "310"));
  await A.sync.flush();
  await B.sync.flush();
  assert.equal(srv.holen().vehicles.b10.leasing, "310");
  assert.match(B.meldungen[0], /bitte kurz prüfen/);
});

test("kommt der Konflikt immer wieder, gibt die App nach fünf Versuchen auf", async () => {
  const srv = fakeServer();
  let n = 0;
  const { sync, log } = client(srv, {
    post: async () => {
      n += 1;
      const fern = srv.holen();
      fern._rev = 100 + n;
      fern.months[M].push(row("2026-11-20", "t03", String(n)));
      return { ok: false, conflict: true, data: fern };
    },
  });
  sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "2900")));
  await sync.flush();
  assert.equal(log.aufgegeben, 1);
  assert.equal(n, 6);
});

test("Netzfehler: Hinweis, nach kurzer Zeit wird von selbst nachgefasst, höchstens dreimal", async () => {
  const srv = fakeServer();
  let ausfall = true;
  const wartend: Array<() => void> = [];
  const { sync, meldungen } = client(srv, {
    post: (_pin, d) => (ausfall ? Promise.resolve({ ok: false, conflict: false } as PostResult) : srv.post(d)),
    later: (fn) => {
      wartend.push(fn);
      return () => undefined;
    },
  });
  sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "2900")));
  await sync.flush();
  assert.deepEqual(meldungen, ["Speichern fehlgeschlagen — bitte Verbindung prüfen"]);
  assert.equal(sync.isClean(), false);
  assert.equal(wartend.length, 1);
  ausfall = false;
  wartend.shift()!();
  await tick();
  assert.deepEqual(eintraege(srv.holen()), ["b10:2900"]);
  assert.equal(sync.isClean(), true);

  // Dauerhafter Ausfall: nur drei Nachfass-Versuche
  ausfall = true;
  sync.edit((d) => d.months[M].push(row("2026-11-13", "b10", "3000")));
  await sync.flush();
  for (let i = 0; i < 6 && wartend.length; i++) {
    wartend.shift()!();
    await tick();
  }
  assert.equal(srv.holen().months[M].filter((r) => r.km === "3000").length, 0);
  assert.equal(wartend.splice(0).length, 0);
});

test("Nachladen: nur wenn nichts Eigenes offen ist und der Server etwas Neues hat", async () => {
  const srv = fakeServer();
  const A = client(srv);
  const B = client(srv);
  B.sync.edit((d) => d.months[M].push(row("2026-11-12", "t03", "12100")));
  await B.sync.flush();
  // A hat selbst etwas offen: nicht überschreiben
  A.sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "2900")));
  assert.equal(A.sync.adoptRemote(srv.holen()), false);
  assert.deepEqual(eintraege(A.sync.current), ["b10:2900"]);
  await A.sync.flush(); // führt zusammen
  assert.deepEqual(eintraege(A.sync.current).sort(), ["b10:2900", "t03:12100"]);
  // nichts Neues: false
  assert.equal(A.sync.adoptRemote(srv.holen()), false);
});

test("der Server formt Daten beim Speichern um: die App speichert trotzdem nicht endlos weiter", async () => {
  const srv = fakeServer({ normalize: (d) => ({ ...d, erfassungStart: d.erfassungStart.toUpperCase() }) });
  const { sync } = client(srv);
  sync.edit((d) => (d.erfassungStart = "abc"));
  await sync.flush();
  assert.equal(srv.anzahl(), 1);
  assert.equal(sync.isClean(), true);
});

test("ausgeschaltet (Testmodus, nicht angemeldet): es wird nichts gespeichert", async () => {
  const srv = fakeServer();
  const { sync } = client(srv);
  sync.setEnabled(false);
  sync.edit((d) => d.months[M].push(row("2026-11-12", "b10", "2900")));
  await sync.flush();
  assert.equal(srv.anzahl(), 0);
});
