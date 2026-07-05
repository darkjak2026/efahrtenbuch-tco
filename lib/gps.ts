"use client";

export interface LocateResult {
  lat: number;
  lon: number;
  ladestation: string;
  toast: string;
}

// Checks the Permissions API without ever triggering a browser prompt itself —
// only reports true if the user already granted geolocation access previously.
export async function hasGeolocationPermission(): Promise<boolean> {
  if (!("permissions" in navigator) || !("geolocation" in navigator)) return false;
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state === "granted";
  } catch {
    return false;
  }
}

export function locateStation(
  currentLadestation: string,
  onDone: (result: LocateResult) => void,
  onError: (msg: string) => void
): void {
  if (!("geolocation" in navigator)) {
    onError("Geolocation wird von diesem Browser nicht unterstützt");
    return;
  }
  if (!window.isSecureContext) {
    onError("GPS braucht HTTPS – diese Seite läuft aktuell nicht über eine sichere Verbindung");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      try {
        const url = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&maxresults=1&distance=0.6&distanceunit=KM&compact=true&verbose=false`;
        const res = await fetch(url);
        const list = await res.json();
        if (list && list.length > 0) {
          const poi = list[0];
          const title = poi.AddressInfo ? poi.AddressInfo.Title : null;
          const op = poi.OperatorInfo ? poi.OperatorInfo.Title : null;
          const name = title ? (op && !title.includes(op) ? `${title} (${op})` : title) : op || "Unbenannte Station";
          onDone({ lat, lon, ladestation: name, toast: "Ladestation gefunden: " + name });
        } else {
          const name = `Koordinaten ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          onDone({ lat, lon, ladestation: name, toast: "Keine Station in der Nähe gefunden (Open Charge Map) – Koordinaten eingetragen" });
        }
      } catch {
        const name = currentLadestation || `Koordinaten ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        onDone({ lat, lon, ladestation: name, toast: "Nachschlagen fehlgeschlagen – Koordinaten wurden trotzdem gespeichert" });
      }
    },
    (err) => {
      if (err.code === 1) onError("Standortzugriff wurde abgelehnt");
      else onError("Standort konnte nicht ermittelt werden");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
