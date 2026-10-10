/** Error thrown when an encryption or decryption operation fails. */
export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}
