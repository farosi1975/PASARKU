/// <reference types="@types/google.maps" />

declare global {
  interface Window {
    google?: typeof google;
  }
}

const MAPS_API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;
let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;
  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${MAPS_API_KEY}&v=weekly&libraries=routes`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => { mapsScriptPromise = null; reject(new Error("Google Maps belum dapat dimuat.")); };
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
}

export async function getGoogleDrivingDistanceKm(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) {
  await loadGoogleMaps();
  if (!window.google?.maps) throw new Error("Google Maps belum tersedia.");
  return new Promise<number>((resolve, reject) => {
    const service = new window.google.maps.DirectionsService();
    service.route({
      origin: { lat: origin.latitude, lng: origin.longitude },
      destination: { lat: destination.latitude, lng: destination.longitude },
      travelMode: window.google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
    }, (result, status) => {
      if (status !== "OK" || !result?.routes[0]?.legs[0]?.distance?.value) return reject(new Error(`Rute Google Maps tidak tersedia (${status}).`));
      resolve(result.routes[0].legs[0].distance.value / 1000);
    });
  });
}
