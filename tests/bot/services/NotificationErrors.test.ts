import { DmDisabledError, UserNotFoundError } from "@bot/services/NotificationErrors";

describe("DmDisabledError", () => {
  it("should be an instance of Error", () => {
    // Act
    const error = new DmDisabledError("user123");
    // Assert
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of DmDisabledError", () => {
    // Act
    const error = new DmDisabledError("user123");
    // Assert
    expect(error).toBeInstanceOf(DmDisabledError);
  });

  it("should have the correct name", () => {
    // Act
    const error = new DmDisabledError("user123");
    // Assert
    expect(error.name).toBe("DmDisabledError");
  });

  it("should expose the userId", () => {
    // Act
    const error = new DmDisabledError("user123");
    // Assert
    expect(error.userId).toBe("user123");
  });

  it("should include the userId in the message", () => {
    // Act
    const error = new DmDisabledError("user123");
    // Assert
    expect(error.message).toContain("user123");
  });
});

describe("UserNotFoundError", () => {
  it("should be an instance of Error", () => {
    // Act
    const error = new UserNotFoundError("user456");
    // Assert
    expect(error).toBeInstanceOf(Error);
  });

  it("should be an instance of UserNotFoundError", () => {
    // Act
    const error = new UserNotFoundError("user456");
    // Assert
    expect(error).toBeInstanceOf(UserNotFoundError);
  });

  it("should have the correct name", () => {
    // Act
    const error = new UserNotFoundError("user456");
    // Assert
    expect(error.name).toBe("UserNotFoundError");
  });

  it("should expose the userId", () => {
    // Act
    const error = new UserNotFoundError("user456");
    // Assert
    expect(error.userId).toBe("user456");
  });

  it("should include the userId in the message", () => {
    // Act
    const error = new UserNotFoundError("user456");
    // Assert
    expect(error.message).toContain("user456");
  });
});
