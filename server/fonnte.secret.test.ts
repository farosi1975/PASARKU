import { describe, expect, it } from "vitest";
import { getFonnteDevices } from "./fonnte";

describe("FONNTE secret configuration", () => {
  it("validates the server-side token through FONNTE get-devices", async () => {
    expect(process.env.FONNTE_TOKEN).toBeTruthy();
    const response = await getFonnteDevices();
    expect(response.status).toBe(true);
  }, 20_000);
});
