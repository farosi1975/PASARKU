import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sendDuePromoNotifications } from "../pushNotifications";
import { processFonnteIncomingRegistration } from "../whatsappRegistration";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/webhooks/fonnte/incoming", async (req, res) => {
    const expectedSecret = process.env.FONNTE_WEBHOOK_SECRET?.trim();
    const providedSecret = String(req.get("x-webhook-secret") || req.get("x-fonnte-secret") || req.body?.secret || req.body?.secret_key || "").trim();
    if (expectedSecret && providedSecret !== expectedSecret) return res.status(401).json({ success: false, message: "Webhook secret tidak valid." });
    try {
      const result = await processFonnteIncomingRegistration({ sender: req.body?.sender, message: req.body?.message });
      return res.json({ success: true, ...result });
    } catch (error) {
      console.error("[FONNTE] Webhook pendaftaran gagal:", error instanceof Error ? error.message : error);
      return res.status(500).json({ success: false, message: "Webhook belum dapat diproses." });
    }
  });
  app.get("/api/internal/promo-notifications", async (req, res) => {
    const expected = process.env.PROMO_CRON_TOKEN?.trim();
    if (!expected || req.query.token !== expected) return res.status(401).json({ success: false, message: "Unauthorized" });
    try { return res.json({ success: true, ...(await sendDuePromoNotifications()) }); }
    catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Promo notification failed" }); }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Never let an API failure fall through to the Vite/static HTML fallback.
  // This keeps client-side JSON parsing reliable for OTP, database, and FONNTE errors.
  app.use("/api", (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan pada layanan API.";
    res.status(500).json({ success: false, message });
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ success: false, message: "API route tidak ditemukan." });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
