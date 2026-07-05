import packageJson from "../package.json";

const LAUNCH_DATE = "2026-07-05";

function formatGerman(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

export default function Footer() {
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE || LAUNCH_DATE;
  return (
    <footer className="app-footer">
      © Jakobs Claudius Digitalensis | {formatGerman(LAUNCH_DATE)} – {formatGerman(buildDate)} | v{packageJson.version}
    </footer>
  );
}
