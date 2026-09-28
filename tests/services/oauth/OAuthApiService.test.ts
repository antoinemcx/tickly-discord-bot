import type { ApiRoute } from "@services/apiBuilder/ApiRoute";
import type { Server } from "node:http";
import { OAuthApiService } from "@services/oauth/OAuthApiService";
import express from "express";

function mockRoute(path: string, method: ApiRoute["method"]): ApiRoute {
  return {
    path,
    method,
    handle: jest.fn((_req: express.Request, res: express.Response) => {
      res.send("ok");
    }),
  } as unknown as ApiRoute;
}

let mockCallbackRoute: ApiRoute;
let service: OAuthApiService;

beforeEach(() => {
  mockCallbackRoute = mockRoute("/oauth/callback", "get");
  service = new OAuthApiService(mockCallbackRoute);
});

afterEach(async () => {
  await service.stop();
});

describe("OAuthApiService", () => {
  describe("Constructor", () => {
    it("should create the service", () => {
      // Assert
      expect(service).toBeDefined();
    });

    it("should register JSON, urlencoded and assets middleware", () => {
      // Arrange
      const customApp = express();
      const useSpy = jest.spyOn(customApp, "use");

      // Act
      const _s = new OAuthApiService(mockCallbackRoute, [], customApp);

      // Assert — json, urlencoded, /assets static, error handler
      expect(useSpy).toHaveBeenCalledTimes(4);
      expect(useSpy).toHaveBeenNthCalledWith(1, expect.any(Function));
      expect(useSpy).toHaveBeenNthCalledWith(2, expect.any(Function));
      expect(useSpy).toHaveBeenNthCalledWith(3, "/assets", expect.any(Function));
    });

    it("should not start Express on construction", () => {
      // Arrange
      jest.spyOn(service.getApp(), "listen");
      // Assert
      expect(service.getApp().listen).not.toHaveBeenCalled();
    });

    describe("Routes registration", () => {
      it("should register the callback route", () => {
        // Arrange
        const customApp = express();
        const getSpy = jest.spyOn(customApp, "get");
        jest.spyOn(customApp, "post");

        // Act
        const _s = new OAuthApiService(mockCallbackRoute, [], customApp);

        // Assert
        expect(getSpy).toHaveBeenCalledWith("/oauth/callback", expect.any(Function));
        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(customApp.post).not.toHaveBeenCalled();
      });

      it("should register additional routes when provided", () => {
        // Arrange
        const customApp = express();
        jest.spyOn(customApp, "get");
        const postSpy = jest.spyOn(customApp, "post");
        const additionalRoute = mockRoute("/oauth/additional", "post");

        // Act
        const _s = new OAuthApiService(mockCallbackRoute, [additionalRoute], customApp);

        // Assert
        expect(postSpy).toHaveBeenCalledWith("/oauth/additional", expect.any(Function));
        expect(customApp.get).toHaveBeenCalledTimes(1);
        expect(postSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("getApp", () => {
    it("should return the Express app provided at construction", () => {
      // Arrange
      const customApp = express();
      const s = new OAuthApiService(mockCallbackRoute, [], customApp);
      // Act & Assert
      expect(s.getApp()).toBe(customApp);
    });

    it("should return a created Express app when none was provided", () => {
      expect(service.getApp()).toBeDefined();
    });
  });

  describe("start", () => {
    it("should start the server on the specified port", async () => {
      // Arrange
      jest.spyOn(service.getApp(), "listen");
      // Act
      await service.start(0);
      // Assert
      expect(service.getApp().listen).toHaveBeenCalledWith(0);
    });

    it("should throw if the service is already running", async () => {
      // Arrange
      await service.start(0);
      // Act & Assert
      await expect(service.start(0)).rejects.toThrow();
    });

    it("should reject when the underlying server emits an error", async () => {
      // Arrange
      const customApp = express();
      const errorMessage = "Failed to start server";
      jest.spyOn(customApp, "listen").mockImplementation(() => ({
        on: (event: string, handler: (error: Error) => void) => {
          if (event === "error")
            setTimeout(() => handler(new Error(errorMessage)), 0);
          return undefined;
        },
      } as unknown as Server));
      const s = new OAuthApiService(mockCallbackRoute, [], customApp);
      // Act & Assert
      await expect(s.start(0)).rejects.toThrow(errorMessage);
    });
  });

  describe("stop", () => {
    it("should stop the server when it is running", async () => {
      // Arrange
      await service.start(0);
      const server = (service as unknown as { server?: { close: () => void } }).server;
      expect(server).toBeDefined();
      const closeSpy = jest.spyOn(server!, "close");
      // Act
      await service.stop();
      // Assert
      expect(closeSpy).toHaveBeenCalled();
      expect((service as unknown as { server?: unknown }).server).toBeUndefined();
    });
  });
});
