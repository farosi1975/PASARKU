import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsUrl } from "../client/src/lib/maps";

describe("Google Maps location links", () => {
  it("builds a Google Maps search URL from valid coordinates", () => {
    expect(buildGoogleMapsUrl("-7.602345, 111.904321")).toBe("https://www.google.com/maps/search/?api=1&query=-7.602345%2C111.904321");
  });

  it("does not create a link for missing or invalid coordinates", () => {
    expect(buildGoogleMapsUrl(null)).toBeNull();
    expect(buildGoogleMapsUrl("Sawahan, Nganjuk")).toBeNull();
    expect(buildGoogleMapsUrl("91, 111")).toBeNull();
  });

  it("builds a driving directions URL from the store to the buyer", () => {
    expect(buildGoogleMapsDirectionsUrl("-7.60,111.90", "-7.61,111.91")).toBe("https://www.google.com/maps/dir/?api=1&destination=-7.61%2C111.91&travelmode=driving&origin=-7.60%2C111.90");
  });
});
