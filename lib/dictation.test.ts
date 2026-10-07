import { test } from "node:test";
import assert from "node:assert/strict";
import { appendDictated } from "./dictation";

test("Diktat hängt mit Leerzeichen an", () => {
  assert.equal(appendDictated("Hallo", "Welt"), "Hallo Welt");
  assert.equal(appendDictated("", "Welt"), "Welt");
  assert.equal(appendDictated("Hallo ", "Welt"), "Hallo Welt");
});

test("wiederholte Wörter am Übergang werden nicht doppelt angehängt", () => {
  assert.equal(appendDictated("die km im Monat", "im Monat anzeigen"), "die km im Monat anzeigen");
  assert.equal(appendDictated("die km im Monat", "die km im Monat"), "die km im Monat");
});

test("leeres Ergebnis ändert nichts", () => {
  assert.equal(appendDictated("Text", "  "), "Text");
});
