import type { Express, NextFunction, Request, Response } from "express";
import type { Server } from "node:http";
import type { ApiRoute } from "./ApiRoute";
import express from "express";

/**
 * Abstract base class for Express-backed micro-services.
 *
 * Subclass constructors must call `setupRoutes()` after initializing their own
 * fields, since the base constructor intentionally does not register routes.
 * This avoids calling overridden methods before the subclass is fully built.
 */
export abstract class ApiService {
  protected readonly app: Express;
  private server?: Server;

  /** @param app optional Express instance; a new one is created when omitted */
  protected constructor(app?: Express) {
    this.app = app ?? express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /** @returns the underlying Express app instance */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Starts the web service on the specified port.
   *
   * @param port port to listen on, defaults to 3000
   * @throws {Error} if the service is already running
   */
  public async start(port: number = 3000): Promise<void> {
    if (this.server) {
      throw new Error("Service is already running");
    }

    await new Promise<void>((resolve, reject) => {
      const server = this.app.listen(port);
      server.on("listening", () => {
        this.server = server;
        resolve();
      });
      server.on("error", reject);
    });
  }

  /** Stops the web service gracefully. */
  public async stop(): Promise<void> {
    if (this.server) {
      const server = this.server;
      this.server = undefined;

      await new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      });
    }
  }

  /**
   * Registers routes on the Express app and attaches the global error handler.
   * Must be called by the subclass constructor after all fields are assigned.
   *
   * @param mandatoryRoutes routes that are always registered
   * @param additionalRoutes optional extra routes appended after the mandatory ones
   */
  protected setupRoutes(mandatoryRoutes: ApiRoute[], additionalRoutes: ApiRoute[] = []): void {
    for (const route of [...mandatoryRoutes, ...additionalRoutes]) {
      this.addRoute(route);
    }

    this.app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).send(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    });
  }

  private addRoute(route: ApiRoute): void {
    const handler = this.wrap(route.handle.bind(route));

    switch (route.method) {
      case "get":
        this.app.get(route.path, handler);
        return;
      case "post":
        this.app.post(route.path, handler);
        return;
      case "put":
        this.app.put(route.path, handler);
        return;
      case "patch":
        this.app.patch(route.path, handler);
        return;
      case "delete":
        this.app.delete(route.path, handler);
        return;
      default: route.method satisfies never;
    }
  }

  private wrap(
    handler: (req: Request, res: Response) => Promise<void>,
  ): (req: Request, res: Response, next: NextFunction) => void {
    return (req, res, next) => {
      handler(req, res).catch(next);
    };
  }
}
