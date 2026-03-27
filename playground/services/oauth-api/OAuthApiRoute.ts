import type { Request, Response } from "express";

export type OAuthRouteMethod = "get" | "post" | "put" | "patch" | "delete";

/** Generic route for the OAuth API. */
export abstract class OAuthApiRoute {
    public constructor(
        public readonly path: string,
        public readonly method: OAuthRouteMethod,
    ) {}

    public abstract handle(req: Request, res: Response): Promise<void>;
}
