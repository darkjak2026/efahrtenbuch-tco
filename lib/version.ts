import projektPass from "../projekt-pass.json";

// Single source for the app version (CLAUDE-Allgemein 6.1): the changelog in
// projekt-pass.json. Footer, Entwicklerbereich and the package.json check in
// version.test.ts all read from here - no second hand-kept number.

export const TOOL_ID = "efahrtenbuch";

export type VersionArt = "Neu" | "Härtung" | "Behoben" | "Design" | "";

export interface VersionEntry {
  ver: string;
  datum: string;
  art: VersionArt;
  text: string;
}

const ART_PREFIX = /^(Neu|Härtung|Behoben|Design):\s*/;

// projekt-pass.json lists oldest-first (entries get appended); newest first here.
export const VERSIONSVERLAUF: VersionEntry[] = [...projektPass.changelog].reverse().map(([datum, ver, raw]) => {
  const m = ART_PREFIX.exec(raw);
  return { ver, datum, art: (m ? m[1] : "") as VersionArt, text: m ? raw.slice(m[0].length) : raw };
});

export const TOOL_VERSION = VERSIONSVERLAUF[0].ver;

// "2.26.00" -> "2.26.0": strict SemVer as package.json needs it.
export function strictSemver(ver: string): string {
  return ver
    .split("+")[0]
    .split(".")
    .map((p) => String(Number(p)))
    .join(".");
}
