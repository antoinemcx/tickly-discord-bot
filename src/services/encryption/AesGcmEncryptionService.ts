import { Buffer } from "node:buffer";
import crypto from "node:crypto";

import { EncryptionError } from "./EncryptionError";

const ALGORITHM = "aes-256-gcm";
/** Length for the Initialization Vector for unique ciphertexts */
const IV_LENGTH = 12;
/** Length for the Advanced Encryption Standard key */
const KEY_LENGTH = 32;

/**
 * Service for encrypting and decrypting strings using AES-256-GCM.
 *
 * Uses a 32-byte key from the TOKEN_ENCRYPTION_KEY environment variable.
 * Each encryption generates a random 12-byte IV for security.
 * Output format: iv:ciphertext:authTag (all base64-encoded).
 */
export class AesGcmEncryptionService {
  private readonly key: Buffer;

  /**
   * Creates a new encryption service instance.
   * @throws {Error} If TOKEN_ENCRYPTION_KEY is missing or empty
   * @throws {Error} If TOKEN_ENCRYPTION_KEY is invalid base64 or wrong length
   */
  constructor() {
    const keyBase64 = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new Error("TOKEN_ENCRYPTION_KEY environment variable is not set");
    }
    this.key = this.loadAndValidateKey(keyBase64);
  }

  /**
   * Encrypts a plaintext string using AES-256-GCM.
   * @param plaintext the string to encrypt
   * @returns The encrypted data in format iv:ciphertext:authTag (base64-encoded)
   * @throws {EncryptionError} If encryption fails
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString("base64"),
      encrypted.toString("base64"),
      authTag.toString("base64"),
    ].join(":");
  }

  /**
   * Decrypts a ciphertext string that was encrypted with this service.
   * @param ciphertext encrypted data as iv:ciphertext:authTag (base64-encoded)
   * @returns the decrypted plaintext string
   * @throws {EncryptionError} if format is invalid or authentication fails
   */
  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      throw new EncryptionError(
        "Invalid ciphertext format: expected iv:ciphertext:authTag",
      );
    }

    const [ivBase64, encryptedBase64, authTagBase64] = parts;

    try {
      const iv = Buffer.from(ivBase64, "base64");
      const encrypted = Buffer.from(encryptedBase64, "base64");
      const authTag = Buffer.from(authTagBase64, "base64");

      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted.toString("utf8");
    } catch {
      throw new EncryptionError(
        "Decryption failed: data may be corrupted or tampered",
      );
    }
  }

  /**
   * Loads and validates the encryption key from base64 string.
   * @param keyBase64 the base64-encoded encryption key
   * @returns the validated 32-byte key buffer
   * @throws {Error} if key is invalid base64 or wrong length
   */
  private loadAndValidateKey(keyBase64: string): Buffer {
    if (!this.isValidBase64(keyBase64)) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be valid base64");
    }

    const keyBuffer = Buffer.from(keyBase64, "base64");
    if (keyBuffer.length !== KEY_LENGTH) {
      throw new Error(
        `TOKEN_ENCRYPTION_KEY must be exactly ${KEY_LENGTH} bytes (got ${keyBuffer.length} bytes)`,
      );
    }

    return keyBuffer;
  }

  /**
   * Checks if a string is valid base64.
   * @param str the string to check
   * @returns true if valid base64, false otherwise
   */
  private isValidBase64(str: string): boolean {
    const base64Regex = /^[a-z0-9+/]*={0,2}$/i;
    if (!base64Regex.test(str)) {
      return false;
    }
    try {
      const decoded = Buffer.from(str, "base64");
      return decoded.toString("base64") === str;
    } catch {
      return false;
    }
  }
}
