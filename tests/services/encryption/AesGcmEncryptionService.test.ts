import { Buffer } from "node:buffer";
import crypto from "node:crypto";

import { AesGcmEncryptionService } from "@services/encryption/AesGcmEncryptionService";
import { EncryptionError } from "@services/encryption/EncryptionError";

describe("AesGcmEncryptionService", () => {
  const validKey = crypto.randomBytes(32).toString("base64");

  beforeEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  afterAll(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  describe("encrypt and decrypt", () => {
    it("should return original plaintext after round-trip", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();
      const plaintext = "my-super-secret-todoist-token-12345";

      // Act
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      // Assert
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for same plaintext due to random IV", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();
      const plaintext = "repeated-secret-data";

      // Act
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // Assert
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should handle empty string", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();
      const plaintext = "";

      // Act
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      // Assert
      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode characters", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();
      const plaintext = "token-with-émojis-🔐-and-accénts";

      // Act
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      // Assert
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("constructor", () => {
    it("should throw Error when TOKEN_ENCRYPTION_KEY is missing", () => {
      // Arrange
      delete process.env.TOKEN_ENCRYPTION_KEY;

      // Act & Assert
      expect(() => new AesGcmEncryptionService()).toThrow(Error);
      expect(() => new AesGcmEncryptionService()).toThrow(
        "TOKEN_ENCRYPTION_KEY environment variable is not set",
      );
    });

    it("should throw Error when TOKEN_ENCRYPTION_KEY is empty", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = "";

      // Act & Assert
      expect(() => new AesGcmEncryptionService()).toThrow(Error);
      expect(() => new AesGcmEncryptionService()).toThrow(
        "TOKEN_ENCRYPTION_KEY environment variable is not set",
      );
    });

    it("should throw Error when key is not valid base64", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = "not-valid-base64!!!";

      // Act & Assert
      expect(() => new AesGcmEncryptionService()).toThrow(Error);
      expect(() => new AesGcmEncryptionService()).toThrow(
        "TOKEN_ENCRYPTION_KEY must be valid base64",
      );
    });

    it("should throw Error when key is wrong length", () => {
      // Arrange
      const shortKey = crypto.randomBytes(16)
        .toString("base64"); // 16 bytes instead of 32
      process.env.TOKEN_ENCRYPTION_KEY = shortKey;

      // Act & Assert
      expect(() => new AesGcmEncryptionService()).toThrow(Error);
      expect(() => new AesGcmEncryptionService()).toThrow(
        "TOKEN_ENCRYPTION_KEY must be exactly 32 bytes",
      );
    });
  });

  describe("decrypt", () => {
    it("should throw EncryptionError when ciphertext format is invalid (not 3 parts)", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();

      // Act & Assert
      expect(() => service.decrypt("invalid-format")).toThrow(EncryptionError);
      expect(() => service.decrypt("invalid-format")).toThrow(
        "Invalid ciphertext format: expected iv:ciphertext:authTag",
      );
    });

    it("should throw EncryptionError when ciphertext has only 2 parts", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();

      // Act & Assert
      expect(() => service.decrypt("part1:part2")).toThrow(EncryptionError);
      expect(() => service.decrypt("part1:part2")).toThrow(
        "Invalid ciphertext format: expected iv:ciphertext:authTag",
      );
    });

    it("should throw EncryptionError when authTag verification fails (tampered data)", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();
      const encrypted = service.encrypt("original-secret");

      // Tamper with the ciphertext portion
      const parts = encrypted.split(":");
      const tamperedCiphertext = Buffer.from("tampered-data").toString("base64");
      const tampered = `${parts[0]}:${tamperedCiphertext}:${parts[2]}`;

      // Act & Assert
      expect(() => service.decrypt(tampered)).toThrow(EncryptionError);
      expect(() => service.decrypt(tampered)).toThrow("Decryption failed");
    });

    it("should throw EncryptionError when authTag is tampered", () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = validKey;
      const service = new AesGcmEncryptionService();
      const encrypted = service.encrypt("original-secret");

      // Tamper with the authTag portion
      const parts = encrypted.split(":");
      const tamperedAuthTag = crypto.randomBytes(16).toString("base64");
      const tampered = `${parts[0]}:${parts[1]}:${tamperedAuthTag}`;

      // Act & Assert
      expect(() => service.decrypt(tampered)).toThrow(EncryptionError);
      expect(() => service.decrypt(tampered)).toThrow("Decryption failed");
    });
  });
});
