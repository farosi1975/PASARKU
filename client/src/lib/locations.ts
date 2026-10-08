export const SAWAHAN_VILLAGES = [
  "Sawahan",
  "Sidorejo",
  "Ngliman",
  "Bareng",
  "Margopatut",
  "Siwalan",
  "Kebonagung",
  "Duren",
  "Bendolo",
] as const;

export const LOCATION_OTHER = "Kecamatan lainnya";
export const SAWAHAN_LOCATION_OPTIONS = [...SAWAHAN_VILLAGES, LOCATION_OTHER] as const;
