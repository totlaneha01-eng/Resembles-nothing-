// Minimal AES-256-GCM helper so bank account numbers are never stored in
// plaintext. BANK_ENCRYPTION_KEY must be a 32-byte value (base64) kept in
// your secrets manager — never commit it.
const crypto = require("crypto");

const KEY = Buffer.from(process.env.BANK_ENCRYPTION_KEY || "", "base64");

function encrypt(plainText) {
  if (KEY.length !== 32) {
    throw new Error("BANK_ENCRYPTION_KEY must decode to exactly 32 bytes — generate one with `openssl rand -base64 32`");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // store iv + authTag + ciphertext together, base64-encoded, so a single column suffices
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(payloadB64) {
  const raw = Buffer.from(payloadB64, "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt };
