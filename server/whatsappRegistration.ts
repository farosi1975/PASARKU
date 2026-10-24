import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { findBuyerByReferralCode, getDb, upsertAccountRole } from "./db";
import { buyerProfiles, whatsappRegistrationRequests } from "./db-tables";

const REQUEST_TTL_MS = 10 * 60 * 1000;
const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
};

const makeRequestCode = () => randomBytes(6).toString("hex").toUpperCase();
const cleanMessage = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
export const parseWhatsAppRegistrationMessage = (value: unknown) => {
  const match = cleanMessage(value).match(/^DAFTAR PASARKU\s+([A-Z0-9]{8,20})$/i);
  return match?.[1]?.toUpperCase() ?? null;
};

export async function createWhatsAppRegistrationRequest(referralCode?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  let requestCode = makeRequestCode();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await db.select({ id: whatsappRegistrationRequests.id }).from(whatsappRegistrationRequests).where(eq(whatsappRegistrationRequests.requestCode, requestCode)).limit(1);
    if (!existing[0]) break;
    requestCode = makeRequestCode();
  }
  await db.insert(whatsappRegistrationRequests).values({
    requestCode,
    referralCode: referralCode?.trim().toUpperCase() || null,
    status: "pending",
    expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
  });
  return { requestCode, expiresIn: REQUEST_TTL_MS / 1000 };
}

export async function getWhatsAppRegistrationStatus(requestCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  const rows = await db.select({ requestCode: whatsappRegistrationRequests.requestCode, whatsapp: whatsappRegistrationRequests.whatsapp, status: whatsappRegistrationRequests.status, expiresAt: whatsappRegistrationRequests.expiresAt }).from(whatsappRegistrationRequests).where(eq(whatsappRegistrationRequests.requestCode, requestCode)).limit(1);
  const request = rows[0];
  if (!request) return { status: "not_found" as const };
  if (request.status === "pending" && request.expiresAt.getTime() < Date.now()) return { status: "expired" as const };
  return { status: request.status as "pending" | "verified" | "rejected" | "expired", whatsapp: request.whatsapp ?? undefined };
}

export async function processFonnteIncomingRegistration(payload: { sender?: unknown; message?: unknown }) {
  const message = cleanMessage(payload.message);
  const requestCode = parseWhatsAppRegistrationMessage(message);
  if (!requestCode) return { handled: false as const, reason: "ignored_message" as const };
  const whatsapp = normalizePhone(String(payload.sender ?? ""));
  if (whatsapp.length < 10) return { handled: false as const, reason: "invalid_sender" as const };

  const db = await getDb();
  if (!db) throw new Error("Database belum tersedia.");
  const requests = await db.select().from(whatsappRegistrationRequests).where(and(eq(whatsappRegistrationRequests.requestCode, requestCode), eq(whatsappRegistrationRequests.status, "pending"), gt(whatsappRegistrationRequests.expiresAt, new Date()))).limit(1);
  const request = requests[0];
  if (!request) return { handled: false as const, reason: "request_not_found" as const };

  const existing = await db.select().from(buyerProfiles).where(eq(buyerProfiles.whatsapp, whatsapp)).limit(1);
  if (existing[0]?.isBanned) {
    await db.update(whatsappRegistrationRequests).set({ whatsapp, status: "rejected", updatedAt: new Date() }).where(eq(whatsappRegistrationRequests.id, request.id));
    return { handled: true as const, status: "rejected" as const, whatsapp };
  }

  const displayName = existing[0]?.name || `Warga ${whatsapp.slice(-4)}`;
  const referralCode = request.referralCode?.trim().toUpperCase() || undefined;
  if (referralCode) {
    const referrer = await findBuyerByReferralCode(referralCode);
    if (!referrer || referrer.whatsapp === whatsapp) {
      await db.update(whatsappRegistrationRequests).set({ whatsapp, status: "rejected", updatedAt: new Date() }).where(eq(whatsappRegistrationRequests.id, request.id));
      return { handled: true as const, status: "rejected" as const, whatsapp };
    }
  }
  await db.insert(buyerProfiles).values({ name: displayName, whatsapp, village: "Sawahan", address: "", referredByCode: referralCode || null, verificationStatus: "verified", isBanned: 0 }).onConflictDoUpdate({ target: buyerProfiles.whatsapp, set: { verificationStatus: "verified", isBanned: 0, referredByCode: referralCode || existing[0]?.referredByCode || null, updatedAt: new Date() } });
  await upsertAccountRole(whatsapp, "buyer", displayName);
  await db.update(whatsappRegistrationRequests).set({ whatsapp, status: "verified", updatedAt: new Date() }).where(eq(whatsappRegistrationRequests.id, request.id));
  return { handled: true as const, status: "verified" as const, whatsapp, name: displayName };
}
