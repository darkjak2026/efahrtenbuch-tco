// npm run bauplan - after every change to docs/technisch/bauplan.json:
// checks all links, sets "stand" to now (Europe/Berlin) when the content
// changed since the last run, and regenerates docs/technisch/bauplan.md.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { berlinStamp, brokenLinks, renderMarkdown, type Bauplan } from "../lib/bauplan";

const jsonPath = new URL("../docs/technisch/bauplan.json", import.meta.url);
const mdPath = new URL("../docs/technisch/bauplan.md", import.meta.url);

const bauplan = JSON.parse(readFileSync(jsonPath, "utf8")) as Bauplan;
const broken = brokenLinks(bauplan);
if (broken.length) {
  console.error("Verweise ohne Ziel:", broken.join(", "));
  process.exit(1);
}

// Compare everything except the timestamp itself with what bauplan.md was built from.
const oldMd = existsSync(mdPath) ? readFileSync(mdPath, "utf8") : "";
const unchanged = oldMd === renderMarkdown(bauplan);
if (!unchanged) {
  bauplan.stand = berlinStamp(new Date());
  writeFileSync(jsonPath, JSON.stringify(bauplan, null, 2) + "\n", "utf8");
}
writeFileSync(mdPath, renderMarkdown(bauplan), "utf8");
console.log(unchanged ? `Bauplan unverändert (Stand ${bauplan.stand}).` : `Bauplan aktualisiert, Stand ${bauplan.stand}.`);
