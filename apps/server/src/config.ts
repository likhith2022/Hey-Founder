import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export type AppConfig = {
  host: string;
  port: number;
  nodeEnv: string;
  sessionTtlDays: number;
  maxConcurrentRuns: number;
  paths: {
    root: string;
    data: string;
    db: string;
    files: string;
    workProducts: string;
    backups: string;
    logs: string;
    sandbox: string;
    vaultKey: string;
    webDist: string;
  };
};

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const root = resolve(process.cwd(), "../..");
  const data = resolve(process.env.DATA_DIR ?? resolve(root, "data"));
  cached = {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 7878),
    nodeEnv: process.env.NODE_ENV ?? "development",
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
    maxConcurrentRuns: Number(process.env.MAX_CONCURRENT_RUNS ?? 2),
    paths: {
      root,
      data,
      db: resolve(data, "ai-company-os.sqlite"),
      files: resolve(data, "files"),
      workProducts: resolve(data, "work-products"),
      backups: resolve(data, "backups"),
      logs: resolve(data, "logs"),
      sandbox: resolve(data, "sandbox"),
      vaultKey: resolve(data, ".vault-key"),
      webDist: resolve(root, "apps/web/dist")
    }
  };
  return cached;
}

export function ensureDataDirs() {
  const paths = getConfig().paths;
  for (const dir of [paths.data, paths.files, paths.workProducts, paths.backups, paths.logs, paths.sandbox]) {
    mkdirSync(dir, { recursive: true });
  }
}
