import type { OAuthApiRoute } from "@services/oauth/OAuthApiRoute";
import type {
  OAuthApiRoutesFactory,
  OAuthCallbackRoute,
  OAuthErrorRoute,
  OAuthSuccessRoute,
} from "@services/oauth/OAuthApiRoutesFactory";
import type { Server } from "node:http";
import { OAuthApiService } from "@services/oauth/OAuthApiService";
import express from "express";

let service: OAuthApiService;
let routesFactoryMock: OAuthApiRoutesFactory;

beforeEach(() => {
  routesFactoryMock = {
    createCallbackRoute: jest.fn().mockReturnValue({
      path: "/oauth/callback",
      method: "get",
      handle: mockRouteHandleMethod("callback mock"),
    } as unknown as OAuthCallbackRoute),
    createErrorRoute: jest.fn().mockReturnValue({
      path: "/oauth/error",
      method: "get",
      handle: mockRouteHandleMethod("error mock"),
    } as unknown as OAuthErrorRoute),
    createSuccessRoute: jest.fn().mockReturnValue({
      path: "/oauth/success",
      method: "get",
      handle: mockRouteHandleMethod("success mock"),
    } as unknown as OAuthSuccessRoute),
    createAdditionalRoutes: jest.fn().mockReturnValue([]),
  };
  service = new OAuthApiService(routesFactoryMock);
});

afterEach(async () => {
  await service.stop();
});

function mockRouteHandleMethod(responseText: string): jest.Mock {
  return jest.fn((_req: express.Request, res: express.Response) => {
    res.send(responseText);
  });
}

describe("OAuthApiService", () => {
  describe("Constructor", () => {
    it("should create", () => {
      // Assert
      expect(service).toBeDefined();
    });

    it("should enable json parsing middleware", () => {
      // Arrange
      const customApp = express();
      const useSpy = jest.spyOn(customApp, "use");

      // Act
      const _result = new OAuthApiService(routesFactoryMock, customApp);

      // Assert
      expect(useSpy).toHaveBeenCalledTimes(3);
      expect(useSpy).toHaveBeenNthCalledWith(1, expect.any(Function));
      expect(useSpy).toHaveBeenNthCalledWith(2, expect.any(Function));
    });

    it("should not start the express app", () => {
      // Arrange
      jest.spyOn(service.getApp(), "listen");
      // Assert
      expect(service.getApp().listen).not.toHaveBeenCalled();
    });

    describe("Routes registration", () => {
      it("should register the mandatory routes", () => {
        // Arrange
        const customApp = express();
        const getSpy = jest.spyOn(customApp, "get");
        jest.spyOn(customApp, "post");
        jest.spyOn(customApp, "put");
        jest.spyOn(customApp, "patch");
        jest.spyOn(customApp, "delete");

        // Act
        const _result = new OAuthApiService(routesFactoryMock, customApp);

        // Assert
        expect(routesFactoryMock.createCallbackRoute).toHaveBeenCalled();
        expect(routesFactoryMock.createSuccessRoute).toHaveBeenCalled();
        expect(routesFactoryMock.createErrorRoute).toHaveBeenCalled();
        expect(routesFactoryMock.createAdditionalRoutes).toHaveBeenCalled();

        expect(getSpy).toHaveBeenCalledWith("/oauth/callback", expect.any(Function));
        expect(getSpy).toHaveBeenCalledWith("/oauth/success", expect.any(Function));
        expect(getSpy).toHaveBeenCalledWith("/oauth/error", expect.any(Function));
        expect(getSpy).toHaveBeenCalledTimes(3);
        expect(customApp.post).not.toHaveBeenCalled();
        expect(customApp.put).not.toHaveBeenCalled();
        expect(customApp.patch).not.toHaveBeenCalled();
        expect(customApp.delete).not.toHaveBeenCalled();
      });

      it("should register additional provider-specific routes", () => {
        // Arrange
        routesFactoryMock.createAdditionalRoutes
          = jest.fn().mockReturnValue([{
            path: "/oauth/additional",
            method: "post",
            handle: mockRouteHandleMethod("additional mock"),
          } as unknown as OAuthApiRoute]);

        const customApp = express();
        jest.spyOn(customApp, "get");
        jest.spyOn(customApp, "post");
        jest.spyOn(customApp, "put");
        jest.spyOn(customApp, "patch");
        jest.spyOn(customApp, "delete");

        // Act
        const _result = new OAuthApiService(routesFactoryMock, customApp);

        // Assert
        expect(routesFactoryMock.createAdditionalRoutes).toHaveBeenCalled();
        expect(customApp.get).toHaveBeenCalledTimes(3);
        expect(customApp.post).toHaveBeenCalledTimes(1);
        expect(customApp.post)
          .toHaveBeenCalledWith("/oauth/additional", expect.any(Function));
        expect(customApp.put).not.toHaveBeenCalled();
        expect(customApp.patch).not.toHaveBeenCalled();
        expect(customApp.delete).not.toHaveBeenCalled();
      });
    });
  });

  describe("getApp", () => {
    it("should return the express app specified on creation", () => {
      // Arrange
      const customApp = express();
      customApp.get("/test", (req, res) => res.send("test"));
      const customAppService = new OAuthApiService(routesFactoryMock, customApp);

      // Act
      const app = customAppService.getApp();

      // Assert
      expect(app).toBe(customApp);
    });

    it("should return the created express app if none was specified on creation", () => {
      // Act
      const app = service.getApp();
      // Assert
      expect(app).toBeDefined();
    });
  });

  describe("start", () => {
    it("should throw if the service is already running", async () => {
      // Arrange
      await service.start(0);
      // Act & Assert
      await expect(service.start(0)).rejects.toThrow();
    });

    it("should start the express app on the specified port", async () => {
      // Arrange
      const port = 0;
      jest.spyOn(service.getApp(), "listen");

      // Act
      await service.start(port);

      // Assert
      expect(service.getApp().listen).toHaveBeenCalledWith(port);
      expect(service.getApp().listen).toBeDefined();
    });

    it("should handle errors when starting the server", async () => {
      // Arrange
      const customApp = express();
      const port = 0;
      const errorMessage = "Failed to start server";
      jest.spyOn(customApp, "listen").mockImplementation(() => ({
        on: (event: string, handler: (error: Error) => void) => {
          if (event === "error") {
            setTimeout(() => handler(new Error(errorMessage)), 0);
          }
          return undefined;
        },
      } as unknown as Server));
      const appService = new OAuthApiService(routesFactoryMock, customApp);

      // Act & Assert
      await expect(appService.start(port)).rejects.toThrow(errorMessage);
    });
  });

  describe("stop", () => {
    it("should stop the server if it's running", async () => {
      // Arrange
      await service.start(0);
      const server = (service as unknown as {
        server?: { close: () => void };
      }).server;
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
