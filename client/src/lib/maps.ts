export function buildGoogleMapsUrl(location?: string | null) {
  if (!location) return null;
  const match = location.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function buildGoogleMapsDirectionsUrl(origin?: string | null, destination?: string | null) {
  const isCoordinate = (value?: string | null) => {
    if (!value) return false;
    const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return false;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  };
  if (!isCoordinate(destination)) return null;
  const params = new URLSearchParams({ api: "1", destination: destination!.replace(/\s+/g, ""), travelmode: "driving" });
  if (isCoordinate(origin)) params.set("origin", origin!.replace(/\s+/g, ""));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
