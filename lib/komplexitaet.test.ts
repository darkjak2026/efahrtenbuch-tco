import { test } from "node:test";
import assert from "node:assert/strict";
import { istCode, zaehle } from "./komplexitaet";

test("Komplexität: Codezeilen ohne Leerzeilen, Endpunkte je HTTP-Methode, Version aus dem Projekt-Pass", () => {
  const k = zaehle([
    { path: "app/api/data/route.ts", content: "export async function GET() {}\n\nexport async function POST() {}\n" },
    { path: "lib/a.ts", content: "const a = 1;\r\n\r\n  \r\nexport { a };\r\n" },
    { path: "lib/a.test.ts", content: "eins\nzwei\n" },
    { path: "README.md", content: "nicht gezählt\n" },
    { path: "package.json", content: JSON.stringify({ version: "2.37.0", dependencies: { a: "1", b: "1" }, devDependencies: { c: "1" } }) },
    { path: "projekt-pass.json", content: JSON.stringify({ changelog: [["01.01.2026", "2.36.00", "Neu: x"], ["02.01.2026", "2.37.00", "Neu: y"]] }) },
  ]);
  assert.deepEqual(k, { version: "2.37.00", loc: 4, dateien: 2, endpunkte: 2, abhaengigkeiten: 3 });
});

test("Komplexität: Testdateien und Doku zählen nicht als Code", () => {
  assert.equal(istCode("lib/data.test.ts"), false);
  assert.equal(istCode("docs/technisch/bauplan.md"), false);
  assert.equal(istCode("server/efahrtenbuch-snapshot.timer"), true);
  assert.equal(istCode("instrumentation.ts"), true);
});
