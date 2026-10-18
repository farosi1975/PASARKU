import "dotenv/config";
import { sendDuePromoNotifications } from "../server/pushNotifications";

try {
  const result = await sendDuePromoNotifications();
  console.log(`[PromoPush] selesai: ${JSON.stringify(result)}`);
} catch (error) {
  console.error("[PromoPush] gagal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
