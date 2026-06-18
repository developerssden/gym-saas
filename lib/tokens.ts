import crypto from "crypto";

/**
 * Generates a secure random invite token (URL-safe base64, 48 bytes → 64 chars)
 */
export function generateToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Hashes a token for storage. Store the hash, send the raw token in the URL.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Returns expiry date: 48 hours from now
 */
export function getTokenExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 48);
  return expiry;
}
