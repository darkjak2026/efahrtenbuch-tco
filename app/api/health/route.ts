import { NextResponse } from "next/server";
import { storageKind } from "@/lib/store";

// Health check for deploy probe and monitoring: no data, no PIN. On the own
// server it also checks that Postgres answers (503 otherwise).
export const dynamic = "force-dynamic";

export async function GET() {
  const storage = storageKind();
  if (storage === "postgres") {
    try {
      await (await import("@/lib/pg-store")).pingDb();
    } catch {
      return NextResponse.json({ ok: false, storage, db: false }, { status: 503 });
    }
  }
  return NextResponse.json({ ok: true, storage });
}
