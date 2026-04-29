import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getConfig } from "../config.js";

function getVaultKey(): Buffer {
  const path = getConfig().paths.vaultKey;
  if (!existsSync(path)) {
    const key = randomBytes(32);
    writeFileSync(path, key.toString("base64"), { mode: 0o600 });
    try {
      chmodSync(path, 0o600);
    } catch {
      // Best effort on non-POSIX filesystems.
    }
    return key;
  }
  return Buffer.from(readFileSync(path, "utf8"), "base64");
}

export function encryptSecret(value: string): { encryptedValue: string; iv: string; authTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { encryptedValue: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptSecret(row: { encrypted_value: string; iv: string; auth_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", getVaultKey(), Buffer.from(row.iv, "base64"));
  decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(row.encrypted_value, "base64")), decipher.final()]).toString("utf8");
}
