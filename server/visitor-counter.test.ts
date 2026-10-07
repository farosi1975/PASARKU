import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("visitor counter", () => {
  it("exposes a public recordVisit mutation for the storefront", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.marketplace.recordVisit();
    expect(result).toEqual({ totalVisits: 0, todayVisits: 0 });
  });
});
