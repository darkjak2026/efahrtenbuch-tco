// Komplexitätswerte für das Monitoring (Bauplan Teil 3): zählt aus einer Liste
// von Dateien (Pfad + Inhalt) Codezeilen, Endpunkte, Abhängigkeiten und die
// Version. Läuft auf dem PC beim Deploy (scripts/komplexitaet.ts) und für die
// rekonstruierten Werte aus der Git-Historie - der Server zählt nichts davon.

export interface Komplexitaet {
  version: string | null;
  loc: number; // Codezeilen ohne Leerzeilen
  dateien: number; // Code-Dateien
  endpunkte: number; // exportierte HTTP-Methoden in app/api/**/route.ts
  abhaengigkeiten: number; // dependencies + devDependencies
}

export interface Quelldatei {
  path: string;
  content: string;
}

const CODE = /^(app|components|lib|scripts|server)\/.*\.(ts|tsx|css|sh|mjs|js|service|timer)$|^instrumentation\.ts$|^server\/Caddyfile\.[a-z]+$/;
const ROUTE = /^app\/api\/.+\/route\.ts$/;
const METHOD = /^export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/gm;

export function istCode(path: string): boolean {
  return CODE.test(path) && !/\.test\.ts$/.test(path);
}

export function zaehle(files: Quelldatei[]): Komplexitaet {
  let loc = 0;
  let dateien = 0;
  let endpunkte = 0;
  let abhaengigkeiten = 0;
  let version: string | null = null;
  for (const f of files) {
    if (istCode(f.path)) {
      dateien++;
      loc += f.content.split(/\r?\n/).filter((l) => l.trim() !== "").length;
      if (ROUTE.test(f.path)) endpunkte += [...f.content.matchAll(METHOD)].length;
    }
    if (f.path === "package.json") {
      try {
        const p = JSON.parse(f.content);
        abhaengigkeiten = Object.keys(p.dependencies ?? {}).length + Object.keys(p.devDependencies ?? {}).length;
        version ??= typeof p.version === "string" ? p.version : null;
      } catch {
        // kaputte package.json in alter Version: Abhängigkeiten bleiben 0
      }
    }
  }
  // Version wie in der App ("2.36.00") aus dem Projekt-Pass, sonst package.json
  const pass = files.find((f) => f.path === "projekt-pass.json");
  if (pass) {
    try {
      const log = JSON.parse(pass.content).changelog;
      const last = Array.isArray(log) && log.length ? log[log.length - 1] : null;
      if (Array.isArray(last) && typeof last[1] === "string") version = last[1];
    } catch {
      // ältere Fassung ohne gültiges JSON
    }
  }
  return { version, loc, dateien, endpunkte, abhaengigkeiten };
}
