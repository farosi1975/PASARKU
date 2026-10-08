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

describe("admin marketplace user sheets", () => {
  it("rejects an invalid sheet role before touching the database", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.manageUserAccess({
      sessionToken: "invalid-session",
      role: "store" as never,
      id: 1,
      action: "ban",
    })).rejects.toThrow();
  });

  it("rejects an invalid access action before touching the database", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.manageUserAccess({
      sessionToken: "invalid-session",
      role: "buyer",
      id: 1,
      action: "delete" as never,
    })).rejects.toThrow();
  });

  it("requires an authenticated admin session for a valid access change", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.manageUserAccess({
      sessionToken: "x".repeat(32),
      role: "buyer",
      id: 1,
      action: "ban",
    })).rejects.toThrow(/sesi admin|admin/i);
  });

  it("validates the document review role", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.reviewDocuments({
      sessionToken: "invalid-session",
      role: "buyer" as never,
      id: 1,
      reviewed: true,
    })).rejects.toThrow();
  });

  it("requires an authenticated admin session for document review", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.reviewDocuments({
      sessionToken: "x".repeat(32),
      role: "seller",
      id: 1,
      reviewed: true,
    })).rejects.toThrow(/sesi admin|admin/i);
  });
});
