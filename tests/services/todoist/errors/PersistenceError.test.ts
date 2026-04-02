import { PersistenceError } from "@services/todoist/errors/PersistenceError";

describe("PersistenceError", () => {
  it("should create with correct name and message", () => {
    // Arrange
    const errorMessage = "Test Persistence error message";

    // Act
    const error = new PersistenceError(errorMessage);

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(PersistenceError);
    expect(error.name).toBe("PersistenceError");
    expect(error.message).toBe(errorMessage);
  });
});
