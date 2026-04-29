import { resolve, basename } from "node:path";
import { AppError } from "../utils/errors.js";

export function safeResolve(baseDir: string, requestedPath: string): string {
  const resolved = resolve(baseDir, requestedPath);
  const base = resolve(baseDir);
  if (resolved !== base && !resolved.startsWith(base + "/")) {
    throw new AppError("UNSAFE_PATH", "Path is outside the permitted local data directory", 400);
  }
  return resolved;
}

export function safeName(name: string): string {
  const clean = basename(name).replace(/[^a-zA-Z0-9._ -]/g, "_").trim();
  if (!clean) throw new AppError("INVALID_FILE_NAME", "File name is invalid", 400);
  return clean;
}
