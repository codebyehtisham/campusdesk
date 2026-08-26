export type CampusFence = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earth = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function evaluateFence(
  latitude: number,
  longitude: number,
  fence: CampusFence
): { onCampus: boolean; distanceMeters: number } {
  const distance = distanceMeters(latitude, longitude, fence.latitude, fence.longitude);
  return { onCampus: distance <= fence.radiusMeters, distanceMeters: distance };
}

export function parseFence(settings: {
  campusLatitude?: number | null;
  campusLongitude?: number | null;
  campusRadiusMeters?: number | null;
}): CampusFence | null {
  if (settings.campusLatitude == null || settings.campusLongitude == null) return null;
  const latitude = Number(settings.campusLatitude);
  const longitude = Number(settings.campusLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const radiusMeters = Math.max(25, Number(settings.campusRadiusMeters) || 250);
  return { latitude, longitude, radiusMeters };
}

export type ScanLocationInput = {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
};

export function parseScanLocation(body: Record<string, unknown>): ScanLocationInput {
  const nested = (body.location && typeof body.location === 'object' ? body.location : {}) as Record<
    string,
    unknown
  >;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const raw = body[key] ?? nested[key];
      if (raw == null || raw === '') continue;
      const num = Number(raw);
      if (Number.isFinite(num)) return num;
    }
    return null;
  };
  return {
    latitude: pick('latitude', 'lat'),
    longitude: pick('longitude', 'lng', 'lon'),
    accuracy: pick('accuracy'),
  };
}

export function parseQrToken(raw: unknown) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.startsWith('explore-attend:')) return value.slice('explore-attend:'.length);
  return value;
}
