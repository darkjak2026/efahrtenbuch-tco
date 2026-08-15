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

// Reverse-geocodes to a human-readable "Straße Nr., PLZ Stadt" via OpenStreetMap/Nominatim
// — used whenever no known charging station is nearby, so the field stays traceable
// instead of falling back to a raw lat/lon pair nobody can place.
async function reverseGeocodeAddress(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    const addr = data?.address;
    if (!addr) return null;
    const street: string | undefined = addr.road || addr.pedestrian || addr.footway;
    const houseNumber: string | undefined = addr.house_number;
    const postcode: string | undefined = addr.postcode;
    const city: string | undefined = addr.city || addr.town || addr.village || addr.municipality;
    const streetPart = street ? (houseNumber ? `${street} ${houseNumber}` : street) : null;
    const cityPart = postcode && city ? `${postcode} ${city}` : postcode || city;
    if (streetPart && cityPart) return `${streetPart}, ${cityPart}`;
    return streetPart || cityPart || null;
  } catch {
    return null;
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
          return;
        }
      } catch {
        // Open Charge Map lookup failed — fall through to the address lookup below.
      }
      const address = await reverseGeocodeAddress(lat, lon);
      if (address) {
        onDone({ lat, lon, ladestation: address, toast: "Keine Station in der Nähe gefunden – Adresse eingetragen: " + address });
      } else {
        const name = currentLadestation || `Koordinaten ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        onDone({ lat, lon, ladestation: name, toast: "Adresse konnte nicht ermittelt werden – Koordinaten wurden trotzdem gespeichert" });
      }
    },
    (err) => {
      if (err.code === 1) onError("Standortzugriff wurde abgelehnt");
      else onError("Standort konnte nicht ermittelt werden");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}
