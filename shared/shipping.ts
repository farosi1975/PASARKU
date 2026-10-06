export type ShippingSettings = {
  ratePerKm: number;
  discountPercent: number;
  originLatitude: string;
  originLongitude: string;
};

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  ratePerKm: 3000,
  discountPercent: 0,
  originLatitude: "-7.602345",
  originLongitude: "111.904321",
};

export function parseCoordinates(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function distanceInKm(from: string | null | undefined, to: ShippingSettings) {
  const source = parseCoordinates(from);
  const target = parseCoordinates(`${to.originLatitude},${to.originLongitude}`);
  if (!source || !target) return 1;
  const earthRadiusKm = 6371;
  const latitudeDelta = ((target.latitude - source.latitude) * Math.PI) / 180;
  const longitudeDelta = ((target.longitude - source.longitude) * Math.PI) / 180;
  const latitude1 = (source.latitude * Math.PI) / 180;
  const latitude2 = (target.latitude * Math.PI) / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.sin(longitudeDelta / 2) ** 2 * Math.cos(latitude1) * Math.cos(latitude2);
  return Math.max(1, earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function calculateShippingCost(settings: ShippingSettings, currentLocation?: string | null, freeShipping = false) {
  if (freeShipping) return 0;
  const distanceKm = distanceInKm(currentLocation, settings);
  const gross = Math.ceil(distanceKm * Math.max(0, settings.ratePerKm));
  const discount = Math.min(100, Math.max(0, settings.discountPercent));
  return Math.max(0, Math.round(gross * (1 - discount / 100)));
}
