import { test } from "node:test";
import assert from "node:assert/strict";
import { MONTHS } from "./constants";
import { monthSheetName } from "./exports";

// Regression guard: the month range spans multiple years, so a bare month label
// ("Juli") repeats and XLSX.book_append_sheet throws "Worksheet with name |Juli|
// already exists!", crashing the whole Excel export.

test("month sheet names are unique across the full range", () => {
  const names = MONTHS.map(monthSheetName);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], `duplicate sheet names would crash the export: ${dupes.join(", ")}`);
  assert.equal(new Set(names).size, MONTHS.length);
});

test("every month sheet name fits Excel's 31-char limit", () => {
  for (const m of MONTHS) {
    const name = monthSheetName(m);
    assert.ok(name.length <= 31, `"${name}" (${name.length} chars) exceeds Excel's 31-char sheet-name limit`);
  }
});

test("month sheet name is qualified with the year", () => {
  const jul26 = MONTHS.find((m) => m.key === "2026-07");
  assert.ok(jul26, "expected a 2026-07 month in range");
  assert.equal(monthSheetName(jul26), "Juli 2026");
});
