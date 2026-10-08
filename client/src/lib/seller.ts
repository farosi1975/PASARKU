export const SELLER_SESSION_KEY = "pasarku_seller_session";
export const SELLER_PRODUCTS_KEY = "pasarku_seller_products";
export const SELLER_OTP = "123456";

export type SellerProfile = { shopName: string; ownerName: string; phone: string; village: string; address?: string | null; avatarUrl?: string | null; identityPhotoUrl?: string | null; selfiePhotoUrl?: string | null; currentLocation?: string | null; openingTime?: string; closingTime?: string; isOpen?: boolean; freeShipping?: boolean; verifiedAt?: string; verificationStatus?: "pending" | "verified" | "rejected" | "unverified" };
export type SellerProduct = { id: string; name: string; category: string; price: number; stock: number; imageUrl?: string | null; createdAt: string };

export function normalizeSellerPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits.startsWith("62") ? digits : digits;
}
