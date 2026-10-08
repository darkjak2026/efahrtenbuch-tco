import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGraphHopperGeocode, parseGraphHopperRoute, parseOrsRoute, routingDienst } from "./routing";

test("Routendienst: GraphHopper vor OpenRouteService, ohne Schlüssel keiner", () => {
  assert.equal(routingDienst({ GRAPHHOPPER_API_KEY: "g", ORS_API_KEY: "o" })?.dienst, "graphhopper");
  assert.equal(routingDienst({ ORS_API_KEY: "o" })?.dienst, "ors");
  assert.equal(routingDienst({}), null);
});

test("GraphHopper-Route: Meter in km, Millisekunden in Minuten", () => {
  assert.deepEqual(parseGraphHopperRoute({ paths: [{ distance: 123456, time: 5_400_000 }] }), { km: 123.456, minutes: 90 });
  assert.equal(parseGraphHopperRoute({ paths: [] }), null);
  assert.deepEqual(parseOrsRoute({ routes: [{ summary: { distance: 1000, duration: 120 } }] }), { km: 1, minutes: 2 });
});

test("GraphHopper-Adressen: nur DE/AT/CH, lesbares Label ohne Dopplungen", () => {
  const r = parseGraphHopperGeocode({
    hits: [
      { point: { lat: 51.5, lng: 11.9 }, name: "Hauptstraße 12", street: "Hauptstraße", housenumber: "12", postcode: "06108", city: "Halle (Saale)", countrycode: "DE" },
      { point: { lat: 48.2, lng: 16.4 }, name: "Wien", city: "Wien", countrycode: "AT" },
      { point: { lat: 52.2, lng: 21.0 }, name: "Warschau", countrycode: "PL" },
      { point: { lat: 50.1, lng: 8.7 }, name: "Hauptbahnhof", postcode: "60329", city: "Frankfurt am Main", countrycode: "DE" },
    ],
  });
  assert.deepEqual(r.map((x) => x.label), ["Hauptstraße 12, 06108 Halle (Saale)", "Wien", "Hauptbahnhof, 60329 Frankfurt am Main"]);
  assert.equal(r[0].lon, 11.9);
});
