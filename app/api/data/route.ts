import { NextRequest, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getAppData, setAppData, storageKind } from "@/lib/store";



export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const data = await getAppData();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  // Reject anything that isn't at least shaped like a real AppData document -
  // a broken/empty request body must never be allowed to migrate() its way
  // into overwriting the household's real data with defaults.
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.months !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  // Alte Adresse nach dem Umzug: nichts mehr annehmen, sonst gingen Einträge verloren.
  if (storageKind() === "redis") {
    const current = await getAppData();
    if (current.movedTo) return NextResponse.json({ error: "moved", movedTo: current.movedTo }, { status: 410 });
  }
  const result = await setAppData(body);
  if (!result.ok) {
    return NextResponse.json({ error: "conflict", data: result.current }, { status: 409 });
  }
  return NextResponse.json(result.data);
}
