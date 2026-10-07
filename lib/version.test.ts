import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOOL_VERSION, VERSIONSVERLAUF, strictSemver } from "./version";

test("package.json trägt dieselbe Version wie der neueste Changelog-Eintrag", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, strictSemver(TOOL_VERSION));
});

test("Versionen haben das Format MAJOR.MINOR.PATCH (PATCH zweistellig)", () => {
  for (const v of VERSIONSVERLAUF) assert.match(v.ver, /^\d+\.\d+\.\d{2}(\+design\.\d{2})?$/, v.ver);
});

test("jeder Eintrag hat eine Art", () => {
  for (const v of VERSIONSVERLAUF) assert.ok(v.art, `${v.ver} ohne Art (Neu/Härtung/Behoben/Design)`);
});
