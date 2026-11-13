import { contentKey, mergeAppData } from "./merge";
import type { PostResult } from "./client-api";
import type { AppData } from "./types";

// Speicher-Ablauf der App ohne React (v2.56.02), damit er sich testen lässt.
//
// - Der eigene Stand lebt hier (data); die Oberfläche bekommt ihn über onData gespiegelt.
// - Es läuft immer nur ein Speichern gleichzeitig. Nach jeder Antwort wird geprüft, ob inzwischen
//   etwas Neues dazukam; wenn ja, geht gleich die nächste Runde mit der neuen Revision raus.
//   (Früher gingen zwei Speichern mit derselben Revision raus und stießen sich selbst ab, und eine
//   Änderung während eines laufenden Speicherns wurde nicht mehr gespeichert.)
// - Hat ein anderes Gerät zwischenzeitlich gespeichert (Konflikt), werden beide Änderungen
//   zusammengeführt (lib/merge.ts) und erneut gespeichert. Nichts wird mehr verworfen.
// - "Gespeichert" heißt: Der Inhalt, den der Server zuletzt von uns bestätigt hat (savedKey).
//   Daran wird gemessen, ob noch etwas offen ist - nicht an der Antwort des Servers, die der
//   Server beim Speichern leicht umformen kann (sonst würde die App endlos weiterspeichern).

export interface SyncDeps {
  post: (pin: string, data: AppData) => Promise<PostResult>;
  // Anzeige aktualisieren
  onData: (data: AppData) => void;
  // Kurze Meldung für die Nutzerin
  notify: (msg: string) => void;
  // Mehrfach hintereinander mit einem anderen Gerät zusammengestoßen: aufgegeben
  onGiveUp: () => void;
  // Zeitgeber für das Nachfassen nach einem Netzfehler; gibt eine Abbruchfunktion zurück
  later?: (fn: () => void, ms: number) => () => void;
}

const MAX_KONFLIKTE = 5;
const MAX_NACHFASSEN = 3;
const NACHFASSEN_MS = 10_000;

export class SaveSync {
  // Nur wenn angemeldet, kein Testmodus und kein aufgegebener Konflikt (setzt die Oberfläche).
  private enabled = false;
  private pin = "";
  private data: AppData;
  private base: AppData | null = null;
  private savedKey = "";
  private saving = false;
  private retries = 0;
  private cancelRetry: (() => void) | null = null;

  constructor(
    private deps: SyncDeps,
    initial: AppData
  ) {
    this.data = initial;
  }

  get current(): AppData {
    return this.data;
  }

  // Die Oberfläche hängt ihre Rückmeldungen nach dem ersten Darstellen an (siehe AppClient).
  connect(deps: SyncDeps): void {
    this.deps = deps;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  setPin(pin: string): void {
    this.pin = pin;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // Alles gespeichert und nichts unterwegs?
  isClean(): boolean {
    return !this.saving && contentKey(this.data) === this.savedKey;
  }

  // Stand vom Server übernehmen (Anmeldung, Nachladen). Der Aufrufer sorgt dafür, dass nichts Eigenes offen ist.
  load(server: AppData): void {
    this.data = server;
    this.base = server;
    this.savedKey = contentKey(server);
    this.deps.onData(server);
  }

  // Alle Änderungen der Oberfläche laufen hier durch und bauen auf dem jüngsten eigenen Stand auf.
  edit(fn: (d: AppData) => void): void {
    const next = structuredClone(this.data);
    fn(next);
    this.data = next;
    this.deps.onData(next);
  }

  // Neueren Serverstand übernehmen, aber nur wenn nichts Eigenes offen ist. true = übernommen.
  adoptRemote(remote: AppData): boolean {
    if (!this.isClean()) return false;
    if (remote._rev === this.base?._rev) return false;
    this.load(remote);
    return true;
  }

  // Nach Netz-Rückkehr wieder bis zu dreimal nachfassen lassen.
  resetRetries(): void {
    this.retries = 0;
  }

  stop(): void {
    this.cancelRetry?.();
    this.cancelRetry = null;
  }

  async flush(): Promise<void> {
    if (!this.enabled || this.saving) return;
    this.saving = true;
    this.cancelRetry?.();
    this.cancelRetry = null;
    let konflikte = 0;
    try {
      for (;;) {
        const snapshot = this.data;
        if (contentKey(snapshot) === this.savedKey) return;
        const result = await this.deps.post(this.pin, snapshot);
        if (result.ok) {
          this.retries = 0;
          this.savedKey = contentKey(snapshot);
          this.base = result.data;
          // Nur die bestätigte Revision übernehmen: Änderungen, die während des Speicherns dazukamen,
          // bleiben erhalten und gehen in der nächsten Runde raus.
          this.data = { ...this.data, _rev: result.data._rev };
          this.deps.onData(this.data);
          continue;
        }
        if (result.conflict) {
          if (++konflikte > MAX_KONFLIKTE || !this.base) {
            this.deps.onGiveUp();
            return;
          }
          const merged = mergeAppData(this.base, this.data, result.data);
          this.base = result.data;
          this.data = merged.data;
          this.deps.onData(this.data);
          this.deps.notify(
            merged.conflicts.length
              ? "Änderungen eines anderen Geräts übernommen – bitte kurz prüfen"
              : "Änderungen eines anderen Geräts übernommen"
          );
          continue;
        }
        this.deps.notify("Speichern fehlgeschlagen — bitte Verbindung prüfen");
        // Netz weg oder kurz gestört: bis zu dreimal von selbst nachfassen.
        if (this.retries < MAX_NACHFASSEN) {
          this.retries += 1;
          const later = this.deps.later ?? ((fn, ms) => {
            const t = setTimeout(fn, ms);
            return () => clearTimeout(t);
          });
          this.cancelRetry = later(() => void this.flush(), NACHFASSEN_MS);
        }
        return;
      }
    } finally {
      this.saving = false;
    }
  }
}
