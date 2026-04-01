import type { Express, NextFunction, Request, Response } from "express";
import type { Server } from "node:http";
import type { OAuthApiRoute } from "./OAuthApiRoute";
import type { OAuthApiRoutesFactory } from "./OAuthApiRoutesFactory";
import express from "express";

/**
 * Generic OAuth API that wires provider-specific handlers to standard routes.
 *
 * It uses a factory to create the minimal routes required for the OAuth flow,
 * while allowing providers to add custom routes as needed.
 */
export class OAuthApiService {
  private readonly app: Express;
  private server?: Server;
  private readonly routesFactory: OAuthApiRoutesFactory;

  /**
   * Creates a new OAuth API web service.
   * @param routesFactory factory that creates all the routes
   * @param app optional Express app instance if it already exists
   */
  constructor(routesFactory: OAuthApiRoutesFactory, app?: Express) {
    this.app = app ?? express();
    this.routesFactory = routesFactory;

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.registerRoutes();
  }

  /** @returns the Express app */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Starts the OAuth web service on the specified port.
   *
   * @param port the web service port, defaults to 3000
   * @throws {Error} if the service is already running
   */
  public async start(port: number = 3000): Promise<void> {
    if (this.server) {
      throw new Error("OAuth API service is already running");
    }

    await new Promise<void>((resolve, reject) => {
      const oauthServer = this.app.listen(port);

      oauthServer.on("listening", () => {
        this.server = oauthServer;
        resolve();
      });
      oauthServer.on("error", reject);
    });
  }

  /** Stops the OAuth web service. */
  public async stop(): Promise<void> {
    if (this.server) {
      const oauthServer = this.server;
      this.server = undefined;

      await new Promise<void>((resolve, reject) => {
        oauthServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  }

  /**
   * Registers all routes created by the factory, including additional
   * provider-specific routes.
   */
  private registerRoutes(): void {
    const mandatoryRoutes: OAuthApiRoute[] = [
      this.routesFactory.createCallbackRoute(),
      this.routesFactory.createSuccessRoute(),
      this.routesFactory.createErrorRoute(),
    ];
    const additionalRoutes = this.routesFactory.createAdditionalRoutes();

    for (const route of [...mandatoryRoutes, ...additionalRoutes]) {
      this.registerRoute(route);
    }

    /* Custom express error handler */
    this.app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).send(err instanceof Error
        ? err.message
        : "Something broke! An unexpected error occured in the OAuth2 service.");
    });
  }

  private registerRoute(route: OAuthApiRoute): void {
    const wrappedHandler = this.wrap(route.handle.bind(route));

    switch (route.method) {
      case "get":
        this.app.get(route.path, wrappedHandler);
        return;
      case "post":
        this.app.post(route.path, wrappedHandler);
        return;
      case "put":
        this.app.put(route.path, wrappedHandler);
        return;
      case "patch":
        this.app.patch(route.path, wrappedHandler);
        return;
      case "delete":
        this.app.delete(route.path, wrappedHandler);
        return;
      default:
        route.method satisfies never;
    }
  }

  /** Wraps a route handler to ensure errors are properly handled. */
  private wrap(
    handler: (req: Request, res: Response) => Promise<void>,
  ): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      handler(req, res).catch(next);
    };
  }
}
