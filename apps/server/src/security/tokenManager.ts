import { getDb } from "../db/index.js";
import { decryptSecret, encryptSecret } from "../vault/localVault.js";
import { id } from "../utils/ids.js";
import { nowIso } from "../utils/time.js";
import { AppError } from "../utils/errors.js";

const PLATFORMS: Record<string, { token: string }> = {
  twitter: { token: "https://api.twitter.com/2/oauth2/token" },
  linkedin: { token: "https://www.linkedin.com/oauth/v2/accessToken" }
};

export async function getValidToken(platform: string): Promise<string> {
  const db = getDb();
  const secret = db.prepare("SELECT * FROM secrets WHERE provider = ? AND name = ?").get(platform, `${platform}_tokens`) as any;
  if (!secret) throw new AppError("NOT_CONNECTED", `Social platform ${platform} is not connected.`, 400);

  const tokens = JSON.parse(decryptSecret(secret));
  const expiresAt = new Date(tokens.expires_at).getTime();
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  if (Date.now() + bufferTime < expiresAt) {
    return tokens.access_token;
  }

  // Token expired or about to expire, refresh it
  if (!tokens.refresh_token) throw new AppError("REFRESH_TOKEN_MISSING", "Refresh token is missing. Please reconnect your account.", 400);

  const config = PLATFORMS[platform];
  const clientIdSecret = db.prepare("SELECT * FROM secrets WHERE provider = ? AND name = ?").get(platform, `${platform}_client_id`) as any;
  const clientSecretSecret = db.prepare("SELECT * FROM secrets WHERE provider = ? AND name = ?").get(platform, `${platform}_client_secret`) as any;

  const clientId = decryptSecret(clientIdSecret);
  const clientSecret = decryptSecret(clientSecretSecret);

  const response = await fetch(config.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token
    })
  });

  if (!response.ok) {
    throw new AppError("TOKEN_REFRESH_FAILED", `Failed to refresh ${platform} token.`, 502);
  }

  const newTokens = await response.json();
  const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
  
  const updatedTokens = { ...tokens, ...newTokens, expires_at: newExpiresAt };
  const encrypted = encryptSecret(JSON.stringify(updatedTokens));
  db.prepare("UPDATE secrets SET encrypted_value = ?, iv = ?, auth_tag = ?, updated_at = ? WHERE id = ?")
    .run(encrypted.encryptedValue, encrypted.iv, encrypted.authTag, nowIso(), secret.id);

  return updatedTokens.access_token;
}
