// Läuft beim Deploy auf dem PC (server/deploy.sh):
//   npx tsx scripts/komplexitaet.ts <Zielordner>
// Schreibt <Zielordner>/komplexitaet.json (heutiger Stand) und
// <Zielordner>/rekonstruktion.json (Komplexitätswerte aus der Git-Historie: je
// Woche der letzte Commit, dazu der letzte Commit jedes Meilenstein-Tags).
// Der Server bekommt so Zahlen, ohne selbst Code oder Git zu sehen.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { istCode, zaehle, type Quelldatei } from "../lib/komplexitaet";

const out = process.argv[2];
if (!out) {
  console.error("Aufruf: tsx scripts/komplexitaet.ts <Zielordner>");
  process.exit(1);
}
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const relevant = (p: string) => istCode(p) || p === "package.json" || p === "projekt-pass.json";

// Heutiger Stand: versionierte Dateien aus dem Arbeitsordner
const heute: Quelldatei[] = git("ls-files")
  .split("\n")
  .filter(relevant)
  .map((path) => ({ path, content: readFileSync(path, "utf8") }));

// Alle Dateien eines Commits in einem Rutsch über git cat-file --batch
function dateienVon(commit: string): Quelldatei[] {
  const paths = git("ls-tree", "-r", "--name-only", commit).split("\n").filter(relevant);
  if (!paths.length) return [];
  const raw = execFileSync("git", ["cat-file", "--batch"], {
    input: paths.map((p) => `${commit}:${p}`).join("\n") + "\n",
    maxBuffer: 256 * 1024 * 1024,
  });
  const files: Quelldatei[] = [];
  let pos = 0;
  for (const path of paths) {
    const nl = raw.indexOf(10, pos);
    const size = Number(raw.subarray(pos, nl).toString("utf8").split(" ")[2]);
    files.push({ path, content: raw.subarray(nl + 1, nl + 1 + size).toString("utf8") });
    pos = nl + 1 + size + 1;
  }
  return files;
}

// Montag der Woche (lokales Datum JJJJ-MM-TT)
function wochenStart(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const bauplan = JSON.parse(readFileSync("docs/technisch/bauplan.json", "utf8")) as { meilensteine?: { datum: string }[] };
const meilensteinTage = new Set((bauplan.meilensteine ?? []).map((m) => m.datum));
const heuteTag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

// git log: neueste zuerst -> der erste Treffer je Woche/Tag ist der letzte Commit
const gewaehlt = new Map<string, { commit: string; tag: string }>();
for (const line of git("log", "--format=%H %ad", "--date=short").split("\n").filter(Boolean)) {
  const [commit, tag] = line.split(" ");
  if (tag >= heuteTag) continue; // heute misst der Server selbst
  for (const key of [`w:${wochenStart(tag)}`, ...(meilensteinTage.has(tag) ? [`m:${tag}`] : [])]) {
    if (!gewaehlt.has(key)) gewaehlt.set(key, { commit, tag });
  }
}
const proTag = new Map<string, string>();
for (const { commit, tag } of gewaehlt.values()) if (!proTag.has(tag)) proTag.set(tag, commit);

const rekonstruktion = [...proTag.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([periode, commit]) => ({ periode, ...zaehle(dateienVon(commit)) }));

mkdirSync(out, { recursive: true });
const jetzt = zaehle(heute);
writeFileSync(join(out, "komplexitaet.json"), JSON.stringify({ ...jetzt, gezaehlt_am: new Date().toISOString() }) + "\n");
writeFileSync(join(out, "rekonstruktion.json"), JSON.stringify(rekonstruktion) + "\n");
console.log(
  `   Komplexität: v${jetzt.version}, ${jetzt.loc} Codezeilen in ${jetzt.dateien} Dateien, ${jetzt.endpunkte} Endpunkte, ` +
    `${jetzt.abhaengigkeiten} Abhängigkeiten; ${rekonstruktion.length} rekonstruierte Tage`
);
