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

describe("marketplace synchronization API", () => {
  it("rejects an incomplete order before any database write", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.createOrder({
      customerName: "",
      whatsapp: "081234567890",
      village: "Sawahan",
      address: "Dusun 1",
      subtotal: 12000,
      delivery: 5000,
      total: 17000,
      payment: "COD",
      items: [],
    })).rejects.toThrow();
  });

  it("rejects an invalid remote status before mutation", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.updateOrderStatus({ orderCode: "INV-TEST", status: "INVALID" as never })).rejects.toThrow();
  });

  it("returns a safe empty result for an unknown order", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.marketplace.order({ orderCode: "INV-NOT-FOUND" });
    expect(result).toBeUndefined();
  });

  it("rejects courier assignment with an invalid phone number", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.assignCourier({ orderCode: "INV-TEST", whatsapp: "123" })).rejects.toThrow();
  });

  it("rejects delivery confirmation without a valid order code", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.confirmDelivery({ orderCode: "" })).rejects.toThrow();
  });
});
