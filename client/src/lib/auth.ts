export const SIMULATED_OTP = "123456";
export const USER_SESSION_KEY = "pasarku_user_session";
export const AUTH_EVENT = "pasarku-auth-changed";

export function normalizeWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}
