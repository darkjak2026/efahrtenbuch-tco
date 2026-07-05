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
  await setAppData(body);
  return NextResponse.json({ ok: true });
}
