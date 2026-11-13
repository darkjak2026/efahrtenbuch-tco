import { test } from "node:test";
import assert from "node:assert/strict";
import { applyLocation, mayAutoLocate, type LocateResult } from "./gps";
import { emptyRow } from "./data";

const ergebnis: LocateResult = { lat: 51.48, lon: 11.97, ladestation: "Dessauer Platz, 06114 Halle (Saale)", toast: "" };

test("Standort wird automatisch abgefragt, außer er ist ausdrücklich gesperrt", () => {
  assert.equal(mayAutoLocate("granted"), true);
  assert.equal(mayAutoLocate("prompt"), true); // Opera Android meldet immer "prompt"
  assert.equal(mayAutoLocate("unknown"), true);
  assert.equal(mayAutoLocate("denied"), false);
});

test("leere Zeile bekommt Koordinaten und Ladestation", () => {
  const row = applyLocation({ ...emptyRow(), datum: "2026-11-11" }, ergebnis);
  assert.equal(row.lat, 51.48);
  assert.equal(row.lon, 11.97);
  assert.equal(row.ladestation, "Dessauer Platz, 06114 Halle (Saale)");
  assert.equal(row.datum, "2026-11-11");
});

test("selbst getippter Stationsname bleibt, Koordinaten werden trotzdem gespeichert", () => {
  const row = applyLocation({ ...emptyRow(), ladestation: "EWE Go Säule 3" }, ergebnis);
  assert.equal(row.ladestation, "EWE Go Säule 3");
  assert.equal(row.lat, 51.48);
  assert.equal(row.lon, 11.97);
});

test("vorhandene Koordinaten werden nicht überschrieben", () => {
  const row = applyLocation({ ...emptyRow(), lat: 50.1, lon: 8.7, ladestation: "Frankfurt" }, ergebnis);
  assert.equal(row.lat, 50.1);
  assert.equal(row.lon, 8.7);
  assert.equal(row.ladestation, "Frankfurt");
});
