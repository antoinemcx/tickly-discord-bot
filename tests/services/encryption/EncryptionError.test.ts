import { EncryptionError } from "@services/encryption/EncryptionError";

describe("EncryptionError", () => {
  it("should create with correct name and message", () => {
    // Arrange
    const errorMessage = "Test Encryption error message";

    // Act
    const error = new EncryptionError(errorMessage);

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EncryptionError);
    expect(error.name).toBe("EncryptionError");
    expect(error.message).toBe(errorMessage);
  });
});
