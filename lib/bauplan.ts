// Bauplan (CLAUDE-Allgemein 6.7, Bauplan-Prompt.md): types, link parsing and
// the Markdown rendering shared by the in-app view, the test and the
// scripts/bauplan.ts generator. Content lives only in docs/technisch/bauplan.json.

export type BauteilOrt = "geraet" | "server" | "extern" | "werkzeug";

export interface Bauteil {
  id: string;
  name: string;
  it: string;
  technik: string;
  ort: BauteilOrt;
  vorhanden: boolean;
  text: string;
}

export interface Bauplan {
  app: string;
  stand: string;
  beschreibung: {
    kurz: string;
    ausgangslage_ziel: string;
    funktionsumfang: string;
    backup_datenschutz: string;
    abhaengigkeiten: string;
    herausforderungen: { vergangenheit: string; gegenwart: string; zukunft: string };
  };
  schiff: Bauteil[];
  glossar: { id: string; begriff: string; erklaerung: string }[];
  // Teil 3: Erklärtext (IT-Jargon) und Meilensteine als Markierung in den Verlaufskurven
  monitoring: string;
  meilensteine: { datum: string; titel: string }[];
  offen: string[];
}

export const ORT_LABEL: Record<BauteilOrt, string> = {
  geraet: "Gerät",
  server: "eigener Server",
  extern: "fremde Dienste",
  werkzeug: "Werkzeug und Pflege",
};

// "[Text](g:glossar-id)" / "[Text](b:bauteil-id)" inside the JSON texts.
export type Segment = { kind: "text"; text: string } | { kind: "g" | "b"; text: string; id: string };

const LINK = /\[([^\]]+)\]\((g|b):([a-z0-9-]+)\)/g;

export function parseLinks(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    if (m.index! > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    out.push({ kind: m[2] as "g" | "b", text: m[1], id: m[3] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function plainText(text: string): string {
  return parseLinks(text)
    .map((s) => s.text)
    .join("");
}

export const BESCHREIBUNG_BLOECKE: { key: string; titel: string; get: (b: Bauplan) => string }[] = [
  { key: "kurz", titel: "Kurz gesagt", get: (b) => b.beschreibung.kurz },
  { key: "ausgangslage", titel: "1.1 Ausgangslage, Vorüberlegungen, Zielsetzung", get: (b) => b.beschreibung.ausgangslage_ziel },
  { key: "funktionen", titel: "1.2 Aktueller Funktionsumfang und Features", get: (b) => b.beschreibung.funktionsumfang },
  { key: "backup", titel: "1.3 Backup, Datensicherung, Datenschutz", get: (b) => b.beschreibung.backup_datenschutz },
  { key: "abhaengigkeiten", titel: "1.4 Abhängigkeiten und beteiligte Dienste", get: (b) => b.beschreibung.abhaengigkeiten },
  { key: "vergangenheit", titel: "1.5 Herausforderungen – Vergangenheit", get: (b) => b.beschreibung.herausforderungen.vergangenheit },
  { key: "gegenwart", titel: "1.5 Herausforderungen – Gegenwart", get: (b) => b.beschreibung.herausforderungen.gegenwart },
  { key: "zukunft", titel: "1.5 Herausforderungen – Zukunft", get: (b) => b.beschreibung.herausforderungen.zukunft },
];

// Every texts' links must point at an existing glossary entry / ship part.
export function brokenLinks(b: Bauplan): string[] {
  const g = new Set(b.glossar.map((x) => x.id));
  const parts = new Set(b.schiff.map((x) => x.id));
  const texts = [
    ...BESCHREIBUNG_BLOECKE.map((x) => x.get(b)),
    ...b.schiff.map((x) => x.text),
    ...b.glossar.map((x) => x.erklaerung),
    b.monitoring,
  ];
  const broken: string[] = [];
  for (const t of texts) {
    for (const s of parseLinks(t)) {
      if (s.kind === "g" && !g.has(s.id)) broken.push(`g:${s.id}`);
      if (s.kind === "b" && !parts.has(s.id)) broken.push(`b:${s.id}`);
    }
  }
  return broken;
}

// Readable bauplan.md - generated, never edited by hand.
export function renderMarkdown(b: Bauplan): string {
  const lines: string[] = [
    `# Bauplan ${b.app}`,
    "",
    `> Erzeugt aus \`docs/technisch/bauplan.json\` mit \`npm run bauplan\` – nicht von Hand bearbeiten.`,
    "",
    `Stand der Dokumentation: ${b.stand}`,
    "",
    "## Teil 1 – Beschreibung der App",
    "",
  ];
  for (const blk of BESCHREIBUNG_BLOECKE) lines.push(`### ${blk.titel}`, "", plainText(blk.get(b)), "");
  lines.push("## Teil 2 – Die Bauteile im Detail", "");
  for (const p of b.schiff) {
    lines.push(
      `### ${p.name} – ${p.it}${p.vorhanden ? "" : " (nicht vorhanden)"}`,
      "",
      `*${ORT_LABEL[p.ort]} · ${p.technik}*`,
      "",
      plainText(p.text),
      ""
    );
  }
  lines.push("## Teil 3 – Monitoring – Metrics History", "", plainText(b.monitoring), "", "### Meilensteine", "");
  for (const m of b.meilensteine) lines.push(`- ${m.datum.split("-").reverse().join(".")}: ${m.titel}`);
  lines.push("");
  lines.push("## Glossar", "");
  for (const g of b.glossar) lines.push(`- **${g.begriff}:** ${plainText(g.erklaerung)}`);
  lines.push("", "## Offene Punkte", "");
  for (const o of b.offen) lines.push(`- ${o}`);
  return lines.join("\n") + "\n";
}

// "TT.MM.JJJJ | HH:MM" in Europe/Berlin.
export function berlinStamp(d: Date): string {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${v("day")}.${v("month")}.${v("year")} | ${v("hour")}:${v("minute")}`;
}
