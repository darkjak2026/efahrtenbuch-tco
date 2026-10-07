import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brokenLinks, renderMarkdown, type Bauplan } from "./bauplan";

const bauplan = JSON.parse(readFileSync(new URL("../docs/technisch/bauplan.json", import.meta.url), "utf8")) as Bauplan;

test("alle Querverweise im Bauplan haben ein Ziel", () => {
  assert.deepEqual(brokenLinks(bauplan), []);
});

test("bauplan.md ist aus der aktuellen bauplan.json erzeugt (npm run bauplan)", () => {
  const md = readFileSync(new URL("../docs/technisch/bauplan.md", import.meta.url), "utf8");
  assert.equal(md.replace(/\r\n/g, "\n"), renderMarkdown(bauplan));
});

test("Bauteil- und Glossar-IDs sind eindeutig", () => {
  const ids = bauplan.schiff.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  const gids = bauplan.glossar.map((g) => g.id);
  assert.equal(new Set(gids).size, gids.length);
});

test("im Bauplan stehen keine Geheimnisse", () => {
  const raw = JSON.stringify(bauplan);
  assert.doesNotMatch(raw, /https:\/\/[a-z0-9-]+\.upstash\.io/i);
  assert.doesNotMatch(raw, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
});
