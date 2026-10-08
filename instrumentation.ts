// Monitoring (Bauplan Teil 3): Start und Serverfehler als Ereignis in ops_events
// melden - nur auf dem eigenen Server (Postgres) und nur in der Node-Laufzeit.
// Der Probelauf beim Deploy meldet sich als Instanz "probe" und zählt nicht zur Laufzeit.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { instanz, recordEvent } = await import("./lib/monitoring");
  await recordEvent("backend_start", { instanz: instanz() });
}

export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { instanz, recordEvent } = await import("./lib/monitoring");
  // Nur Pfad ohne Abfrage (keine Adressen o. Ä.) und eine gekürzte Meldung
  await recordEvent("server_fehler", {
    instanz: instanz(),
    pfad: request.path.split("?")[0],
    methode: request.method,
    meldung: (err instanceof Error ? err.message : String(err)).slice(0, 200),
  });
}
