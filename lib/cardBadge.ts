// Placeholder badges for known charging-card providers (colored initials) until
// real logo image files are supplied — swap the <img>/background here once available.
const KNOWN_BADGES: Record<string, { label: string; color: string }> = {
  "EWE Go": { label: "EWE", color: "#1a7a4c" },
  InCharge: { label: "IC", color: "#0057b8" },
  "Aral pulse": { label: "Aral", color: "#0056a4" },
  "EnBW HyperNetz": { label: "EnBW", color: "#f39200" },
  Chargemap: { label: "CM", color: "#00b2a9" },
  Zuhause: { label: "🏠", color: "#4b3868" },
};

export function cardBadge(name: string): { label: string; color: string } {
  return KNOWN_BADGES[name] || { label: name.slice(0, 2).toUpperCase(), color: "#6fa8c7" };
}
