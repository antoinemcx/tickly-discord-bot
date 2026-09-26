import type { ApiRoute } from "@services/apiBuilder/ApiRoute";
import type { Server } from "node:http";
import { ApiService } from "@services/apiBuilder/ApiService";
import express from "express";

/** Minimal concrete subclass used to exercise ApiService under test. */
class TestApiService extends ApiService {
  public constructor(
    routes: ApiRoute[] = [],
    additionalRoutes: ApiRoute[] = [],
    app?: express.Express,
  ) {
    super(app);
    this.setupRoutes(routes, additionalRoutes);
  }
}

function mockRoute(path: string, method: ApiRoute["method"]): ApiRoute {
  return {
    path,
    method,
    handle: jest.fn((_req: express.Request, res: express.Response) => {
      res.send("ok");
    }),
  } as unknown as ApiRoute;
}

let service: TestApiService;

beforeEach(() => {
  service = new TestApiService();
});

afterEach(async () => {
  await service.stop();
});

describe("ApiService", () => {
  describe("Constructor", () => {
    it("should create the service", () => {
      // Assert
      expect(service).toBeDefined();
    });

    it("should register JSON and urlencoded middleware", () => {
      // Arrange
      const customApp = express();
      const useSpy = jest.spyOn(customApp, "use");

      // Act — setupRoutes adds a 3rd use() call for the error handler
      const _s = new TestApiService([], [], customApp);

      // Assert
      expect(useSpy).toHaveBeenCalledTimes(3);
      expect(useSpy).toHaveBeenNthCalledWith(1, expect.any(Function));
      expect(useSpy).toHaveBeenNthCalledWith(2, expect.any(Function));
    });

    it("should not start Express on construction", () => {
      // Arrange
      jest.spyOn(service.getApp(), "listen");

      // Assert
      expect(service.getApp().listen).not.toHaveBeenCalled();
    });

    describe("setupRoutes", () => {
      it("should register mandatory routes on the Express app", () => {
        // Arrange
        const customApp = express();
        const getSpy = jest.spyOn(customApp, "get");
        const routes = [mockRoute("/a", "get"), mockRoute("/b", "get")];

        // Act
        const _s = new TestApiService(routes, [], customApp);

        // Assert
        expect(getSpy).toHaveBeenCalledWith("/a", expect.any(Function));
        expect(getSpy).toHaveBeenCalledWith("/b", expect.any(Function));
        expect(getSpy).toHaveBeenCalledTimes(2);
      });

      it("should register additional routes after the mandatory ones", () => {
        // Arrange
        const customApp = express();
        jest.spyOn(customApp, "get");
        const postSpy = jest.spyOn(customApp, "post");
        const mandatory = [mockRoute("/required", "get")];
        const additional = [mockRoute("/optional", "post")];

        // Act
        const _s = new TestApiService(mandatory, additional, customApp);

        // Assert
        expect(postSpy).toHaveBeenCalledWith("/optional", expect.any(Function));
      });

      it("should support all HTTP methods", () => {
        // Arrange
        const customApp = express();
        jest.spyOn(customApp, "get");
        jest.spyOn(customApp, "post");
        jest.spyOn(customApp, "put");
        jest.spyOn(customApp, "patch");
        jest.spyOn(customApp, "delete");
        const routes = [
          mockRoute("/r-get", "get"),
          mockRoute("/r-post", "post"),
          mockRoute("/r-put", "put"),
          mockRoute("/r-patch", "patch"),
          mockRoute("/r-delete", "delete"),
        ];

        // Act
        const _s = new TestApiService(routes, [], customApp);

        // Assert
        expect(customApp.get).toHaveBeenCalledWith("/r-get", expect.any(Function));
        expect(customApp.post).toHaveBeenCalledWith("/r-post", expect.any(Function));
        expect(customApp.put).toHaveBeenCalledWith("/r-put", expect.any(Function));
        expect(customApp.patch).toHaveBeenCalledWith("/r-patch", expect.any(Function));
        expect(customApp.delete).toHaveBeenCalledWith("/r-delete", expect.any(Function));
      });
    });
  });

  describe("getApp", () => {
    it("should return the Express app provided at construction", () => {
      // Arrange
      const customApp = express();
      const s = new TestApiService([], [], customApp);

      // Act
      const app = s.getApp();

      // Assert
      expect(app).toBe(customApp);
    });

    it("should return a created Express app when none was provided", () => {
      // Act
      const app = service.getApp();

      // Assert
      expect(app).toBeDefined();
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
          if (event === "error") {
            setTimeout(() => handler(new Error(errorMessage)), 0);
          }
          return undefined;
        },
      } as unknown as Server));
      const s = new TestApiService([], [], customApp);

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
