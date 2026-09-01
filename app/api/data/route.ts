import { NextRequest, NextResponse } from "next/server";
import { getAppData, setAppData } from "@/lib/redis";

function isAuthorized(req: NextRequest): boolean {
  const pin = process.env.LADEPROTOKOLL_PIN;
  if (!pin) return false;
  const headerPin = req.headers.get("x-pin");
  const cookiePin = req.cookies.get("ladeprotokoll_pin")?.value;
  return headerPin === pin || cookiePin === pin;
}

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
  const result = await setAppData(body);
  if (!result.ok) {
    return NextResponse.json({ error: "conflict", data: result.current }, { status: 409 });
  }
  return NextResponse.json(result.data);
}
