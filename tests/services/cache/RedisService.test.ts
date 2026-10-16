import { RedisService } from "@services/cache/RedisService";
import Redis from "ioredis";

jest.mock("ioredis");

describe("RedisService", () => {
  let mockClient: {
    connect: jest.Mock;
    on: jest.Mock;
    config: jest.Mock;
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      config: jest.fn().mockResolvedValue("OK"),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    jest.mocked(Redis).mockImplementation(() => mockClient as unknown as Redis);

    service = new RedisService("localhost", 6379, 32);
  });

  describe("initialize", () => {
    it("should mark the service as available on successful connection", async () => {
      // Arrange
      // Act
      await service.initialize();
      // Assert
      expect(service.isAvailable()).toBe(true);
    });

    it("should apply maxmemory CONFIG SET using the configured limit after connecting", async () => {
      // Arrange
      service = new RedisService("localhost", 6379, 64);
      // Act
      await service.initialize();
      // Assert
      expect(mockClient.config).toHaveBeenCalledWith("SET", "maxmemory", "64mb");
      expect(mockClient.config).toHaveBeenCalledWith(
        "SET",
        "maxmemory-policy",
        "allkeys-lru",
      );
    });

    it("should mark the service as unavailable and not throw when connect fails", async () => {
      // Arrange
      mockClient.connect.mockRejectedValue(new Error("Connection refused"));

      // Act & Assert
      await expect(service.initialize()).resolves.toBeUndefined();
      expect(service.isAvailable()).toBe(false);
    });

    it("should remain available and not throw when CONFIG SET fails", async () => {
      // Arrange
      mockClient.config.mockRejectedValue(new Error("CONFIG SET not allowed"));
      // Act
      await service.initialize();
      // Assert
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe("isAvailable", () => {
    it("should return false before initialize is called", () => {
      // Act
      const result = service.isAvailable();
      // Assert
      expect(result).toBe(false);
    });

    it("should return true after a successful initialize", async () => {
      // Arrange
      await service.initialize();
      // Act
      const result = service.isAvailable();
      // Assert
      expect(result).toBe(true);
    });
  });

  describe("get", () => {
    it("should return null and not call Redis when the service is not available", async () => {
      // Act
      const result = await service.get<string>("some-key");
      // Assert
      expect(result).toBeNull();
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it("should return null when the key does not exist in Redis", async () => {
      // Arrange
      await service.initialize();
      mockClient.get.mockResolvedValue(null);
      // Act
      const result = await service.get<string>("missing-key");
      // Assert
      expect(result).toBeNull();
    });

    it("should return the deserialized string value when the key exists", async () => {
      // Arrange
      await service.initialize();
      mockClient.get.mockResolvedValue(JSON.stringify("my-access-token"));
      // Act
      const result = await service.get<string>("tickly:access_token:user1");
      // Assert
      expect(result).toBe("my-access-token");
    });

    it("should return the deserialized object value when the key exists", async () => {
      // Arrange
      await service.initialize();
      const cached = { id: "123", name: "Task" };
      mockClient.get.mockResolvedValue(JSON.stringify(cached));

      // Act
      const result = await service.get<{ id: string; name: string }>("some-key");

      // Assert
      expect(result).toEqual(cached);
    });

    it("should return null and not throw when the Redis get call throws", async () => {
      // Arrange
      await service.initialize();
      mockClient.get.mockRejectedValue(new Error("Network error"));

      // Act
      const result = await service.get<string>("some-key");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("should do nothing when the service is not available", async () => {
      // Act
      await service.set("some-key", "value", 60);
      // Assert
      expect(mockClient.set).not.toHaveBeenCalled();
    });

    it("should JSON-serialize the value and store it with the correct EX TTL", async () => {
      // Arrange
      await service.initialize();

      // Act
      await service.set("tickly:access_token:user1", "my-access-token", 1200);

      // Assert
      expect(mockClient.set).toHaveBeenCalledWith(
        "tickly:access_token:user1",
        JSON.stringify("my-access-token"),
        "EX",
        1200,
      );
    });

    it("should not throw when the Redis set call throws", async () => {
      // Arrange
      await service.initialize();
      mockClient.set.mockRejectedValue(new Error("Out of memory"));

      // Act & Assert
      await expect(service.set("some-key", "value", 60)).resolves.toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should do nothing when the service is not available", async () => {
      // Act
      await service.delete("some-key");
      // Assert
      expect(mockClient.del).not.toHaveBeenCalled();
    });

    it("should call del with the correct key", async () => {
      // Arrange
      await service.initialize();
      // Act
      await service.delete("tickly:access_token:user1");
      // Assert
      expect(mockClient.del).toHaveBeenCalledWith("tickly:access_token:user1");
    });

    it("should not throw when the Redis del call throws", async () => {
      // Arrange
      await service.initialize();
      mockClient.del.mockRejectedValue(new Error("Connection lost"));

      // Act & Assert
      await expect(service.delete("some-key")).resolves.toBeUndefined();
    });
  });
});
