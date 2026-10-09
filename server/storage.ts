import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

export type StoragePutResult = { key: string; url: string | null };

type StorageData = Buffer | Uint8Array | string;

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

function getR2Config() {
  if (!ENV.r2Endpoint || !ENV.r2AccessKeyId || !ENV.r2SecretAccessKey || !ENV.r2Bucket) return null;
  return {
    client: new S3Client({
      region: "auto",
      endpoint: ENV.r2Endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId: ENV.r2AccessKeyId, secretAccessKey: ENV.r2SecretAccessKey },
    }),
    bucket: ENV.r2Bucket,
    publicBaseUrl: ENV.r2PublicBaseUrl.replace(/\/+$/, ""),
  };
}

function getSupabaseConfig() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceRoleKey || !ENV.supabaseBucket) return null;
  return {
    baseUrl: ENV.supabaseUrl.replace(/\/+$/, ""),
    serviceRoleKey: ENV.supabaseServiceRoleKey,
    bucket: ENV.supabaseBucket,
  };
}

function buildInlineDataUrl(data: StorageData, contentType: string): string {
  return `data:${contentType};base64,${Buffer.from(data).toString("base64")}`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function encodeStoragePath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function putToSupabase(key: string, data: StorageData, contentType: string, requirePublicUrl: boolean): Promise<StoragePutResult | null> {
  const supabase = getSupabaseConfig();
  if (!supabase || !requirePublicUrl) return null;
  const uploadUrl = `${supabase.baseUrl}/storage/v1/object/${encodeURIComponent(supabase.bucket)}/${encodeStoragePath(key)}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      apikey: supabase.serviceRoleKey,
      "Content-Type": contentType,
      "x-upsert": "true",
      "cache-control": "31536000",
    },
    body: Buffer.from(data),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Supabase Storage upload failed (${response.status}): ${message.slice(0, 300)}`);
  }
  return { key, url: `${supabase.baseUrl}/storage/v1/object/public/${encodeURIComponent(supabase.bucket)}/${encodeStoragePath(key)}` };
}

async function putToR2(key: string, data: StorageData, contentType: string, requirePublicUrl: boolean): Promise<StoragePutResult | null> {
  const r2 = getR2Config();
  if (!r2 || (requirePublicUrl && !r2.publicBaseUrl)) return null;
  await r2.client.send(new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: data, ContentType: contentType }));
  return { key, url: r2.publicBaseUrl ? `${r2.publicBaseUrl}/${key}` : null };
}

export async function storagePut(relKey: string, data: StorageData, contentType = "application/octet-stream", options?: { useSupabase?: boolean }): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const supabaseResult = options?.useSupabase === false ? null : await putToSupabase(key, data, contentType, true);
  if (supabaseResult?.url) return { key: supabaseResult.key, url: supabaseResult.url };
  const r2Result = await putToR2(key, data, contentType, true);
  if (r2Result?.url) return { key: r2Result.key, url: r2Result.url };

  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    return { key, url: buildInlineDataUrl(data, contentType) };
  }

  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: new Blob([data as any], { type: contentType }) });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

/** Uploads a document to private R2/legacy storage. Supabase public storage is reserved for catalog images. */
export async function storagePutPrivate(relKey: string, data: StorageData, contentType = "application/octet-stream"): Promise<StoragePutResult> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const r2Result = await putToR2(key, data, contentType, false);
  if (r2Result) return r2Result;
  const legacy = await storagePut(relKey, data, contentType, { useSupabase: false });
  return { key: legacy.key, url: legacy.url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  const r2 = getR2Config();
  if (r2) return getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.bucket, Key: key }), { expiresIn: 300 });

  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = (await resp.json()) as { url: string };
  return url;
}
