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

export const PASARKU_REGENCY = "Nganjuk";
export const PASARKU_DISTRICT = "Sawahan";
export const LOCATION_OTHER = "Kecamatan lainnya";
export const SAWAHAN_LOCATION_OPTIONS = [...SAWAHAN_VILLAGES, LOCATION_OTHER] as const;
