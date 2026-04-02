import { OAuthError } from "@services/todoist/errors/OAuthError";

describe("OAuthError", () => {
  it("should create with correct name and message", () => {
    // Arrange
    const errorMessage = "Test OAuth error message";

    // Act
    const error = new OAuthError(errorMessage);

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(OAuthError);
    expect(error.name).toBe("OAuthError");
    expect(error.message).toBe(errorMessage);
  });
});
