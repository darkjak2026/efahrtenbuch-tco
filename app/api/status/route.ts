import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { storageKind } from "@/lib/store";

// Monitoring (Bauplan Teil 3), nur mit Haushalts-PIN und nur auf dem eigenen Server.
// GET: aktuelle Kennzahlen + Verlauf aus metrics_history. POST: Schnappschuss des
// heutigen Tages schreiben (nächtlicher systemd-Timer, jeder Deploy, Knopf im Bauplan).
// Liefert nur Zahlen - keine Geheimnisse, keine Inhalte des Datensatzes.
export const dynamic = "force-dynamic";

function guard(req: NextRequest): NextResponse | null {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (storageKind() !== "postgres") return NextResponse.json({ error: "kein Monitoring ohne eigenen Server" }, { status: 503 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  const { collect, history } = await import("@/lib/monitoring");
  const [aktuell, verlauf] = await Promise.all([collect(), history()]);
  return NextResponse.json({ aktuell, verlauf });
}

export async function POST(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  const { snapshot } = await import("@/lib/monitoring");
  const aktuell = await snapshot();
  return NextResponse.json({ ok: true, periode: aktuell.periode });
}
