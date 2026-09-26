import type { Request, Response } from "express";

export type RouteMethod = "get" | "post" | "put" | "patch" | "delete";

/** Generic HTTP route for an Express-backed API service. */
export abstract class ApiRoute {
  public constructor(
    public readonly path: string,
    public readonly method: RouteMethod,
  ) {}

  public abstract handle(req: Request, res: Response): Promise<void>;
}
