import { describe, expect, it } from "vitest";
import { buildGoogleMapsUrl } from "../client/src/lib/maps";

describe("Google Maps location links", () => {
  it("builds a Google Maps search URL from valid coordinates", () => {
    expect(buildGoogleMapsUrl("-7.602345, 111.904321")).toBe("https://www.google.com/maps/search/?api=1&query=-7.602345%2C111.904321");
  });

  it("does not create a link for missing or invalid coordinates", () => {
    expect(buildGoogleMapsUrl(null)).toBeNull();
    expect(buildGoogleMapsUrl("Sawahan, Nganjuk")).toBeNull();
    expect(buildGoogleMapsUrl("91, 111")).toBeNull();
  });
});
