import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { getConfig, ensureDataDirs } from "./config.js";
import { migrate } from "./db/migrate.js";
import { registerAuthRoutes } from "./api/auth.js";
import { registerSetupRoutes } from "./api/setup.js";
import { registerSettingsRoutes } from "./api/settings.js";
import { registerResourceRoutes } from "./api/resourceRoutes.js";
import { registerSecretRoutes } from "./api/secrets.js";
import { registerApprovalRoutes } from "./api/approvals.js";
import { registerRunRoutes } from "./api/runs.js";
import { registerGoalRoutes } from "./api/goals.js";
import { registerFileRoutes } from "./api/files.js";
import { registerBackupRoutes } from "./api/backup.js";
import { registerEventRoutes } from "./api/events.js";
import { registerChatRoutes } from "./api/chat.js";
import { registerSOPRoutes } from "./api/sops.js";
import { registerSocialAuthRoutes } from "./api/authSocial.js";
import { startScheduler } from "./scheduler/scheduler.js";
import { AutopilotLoop } from "./engine/AutopilotLoop.js";
import { log } from "./utils/logger.js";

ensureDataDirs();
migrate();

const config = getConfig();
const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 });

await app.register(rateLimit, { max: Number(process.env.RATE_LIMIT_MAX ?? 240), timeWindow: "1 minute" });
await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1 } });
if (config.nodeEnv !== "production") {
  await app.register(cors, { origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/], credentials: true });
}

app.get("/api/health", async () => ({ ok: true, product: "AI Company OS", local: true, at: new Date().toISOString() }));

await registerSetupRoutes(app);
await registerAuthRoutes(app);
await registerSettingsRoutes(app);
await registerResourceRoutes(app);
await registerSecretRoutes(app);
await registerApprovalRoutes(app);
await registerRunRoutes(app);
await registerGoalRoutes(app);
await registerFileRoutes(app);
await registerBackupRoutes(app);
await registerEventRoutes(app);
await registerChatRoutes(app);
await registerSOPRoutes(app);
await registerSocialAuthRoutes(app);

if (existsSync(config.paths.webDist)) {
  await app.register(fastifyStatic, { root: config.paths.webDist, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.status(404).send({ error: "NOT_FOUND", message: "Endpoint not found" });
    return reply.sendFile("index.html");
  });
}

const loop = new AutopilotLoop();
loop.start();
startScheduler();

const shutdown = async () => {
  loop.stop();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await app.listen({ host: config.host, port: config.port });
log("info", `AI Company OS listening on http://${config.host}:${config.port}`);
