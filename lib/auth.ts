import type { NextRequest } from "next/server";

// Haushalts-PIN prüfen (Header x-pin oder Cookie) - für alle API-Routen mit Daten.
export function isAuthorized(req: NextRequest): boolean {
  const pin = process.env.LADEPROTOKOLL_PIN;
  if (!pin) return false;
  const headerPin = req.headers.get("x-pin");
  const cookiePin = req.cookies.get("ladeprotokoll_pin")?.value;
  return headerPin === pin || cookiePin === pin;
}
