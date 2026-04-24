import type { Tickly } from "@bot/Tickly";
import { Handler } from "@bot/handlers/Handler";

let mockedHandler: MockHandler;

class MockHandler extends Handler {
  public getClient() {
    return this.client;
  }
}

describe("Handler", () => {
  beforeEach(() => {
    mockedHandler = new MockHandler();
  });

  describe("setClient", () => {
    it("should set the client", () => {
      // Arrange
      const mockClient = {} as Tickly;
      // Act
      mockedHandler.setClient(mockClient);
      // Assert
      expect(mockedHandler.getClient()).toBe(mockClient);
    });
  });

  describe("setup", () => {
    it("should throw if the client is not set", async () => {
      // Act & Assert
      await expect(mockedHandler.setup()).rejects.toThrow(
        "The client is not set for handler.",
      );
    });

    it("should resolve if the client is set", async () => {
      // Arrange
      const mockClient = {} as Tickly;
      mockedHandler.setClient(mockClient);
      // Act & Assert
      await expect(mockedHandler.setup()).resolves.toBeUndefined();
    });
  });
});
