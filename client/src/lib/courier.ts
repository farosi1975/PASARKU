export const COURIER_SESSION_KEY = "pasarku_courier_session";
export const COURIER_OTP = "123456";

export type CourierProfile = { name: string; phone: string; vehicle: string; village?: string; address?: string; verifiedAt?: string; verificationStatus?: "pending" | "verified" | "rejected" | "unverified" };

export function normalizeCourierPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits.startsWith("62") ? digits : digits;
}
