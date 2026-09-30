const FONNTE_API_URL = "https://api.fonnte.com";

type FonnteResponse = {
  status?: boolean;
  reason?: string;
  message?: string;
  [key: string]: unknown;
};

function getFonnteToken() {
  const token = process.env.FONNTE_TOKEN?.trim();
  if (!token) throw new Error("FONNTE_TOKEN belum dikonfigurasi.");
  return token;
}

async function parseResponse(response: Response): Promise<FonnteResponse> {
  const body = await response.text();
  try {
    return JSON.parse(body) as FonnteResponse;
  } catch {
    throw new Error(`Respons FONNTE tidak valid (${response.status}).`);
  }
}

export async function getFonnteDevices() {
  const response = await fetch(`${FONNTE_API_URL}/get-devices`, {
    method: "POST",
    headers: { Authorization: getFonnteToken() },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await parseResponse(response);
  if (!response.ok || payload.status !== true) throw new Error(String(payload.reason || payload.message || "Token FONNTE tidak valid."));
  return payload;
}

export async function sendFonnteMessage(target: string, message: string) {
  const body = new URLSearchParams({ target, message, countryCode: "62", connectOnly: "true" });
  const response = await fetch(`${FONNTE_API_URL}/send`, {
    method: "POST",
    headers: { Authorization: getFonnteToken(), "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await parseResponse(response);
  if (!response.ok || payload.status !== true) throw new Error(String(payload.reason || payload.message || "OTP FONNTE gagal dikirim."));
  return payload;
}
