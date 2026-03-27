import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { OAuthApiRoute } from "./OAuthApiRoute";
import type { OAuthApiRoutesFactory } from "./OAuthApiRoutesFactory";

export interface OAuthApiServiceConfig {
    app?: Express;
    enableJsonBodyParser?: boolean;
    enableUrlEncodedBodyParser?: boolean;
}

/**
 * Generic OAuth API that wires provider-specific handlers to standard routes.
 */
export class OAuthApiService {
    private readonly app: Express;

    constructor(
        config: OAuthApiServiceConfig,
        private readonly routesFactory: OAuthApiRoutesFactory,
    ) {
        this.app = config.app ?? express();

        if (config.enableJsonBodyParser ?? true) {
            this.app.use(express.json());
        }

        if (config.enableUrlEncodedBodyParser ?? true) {
            this.app.use(express.urlencoded({ extended: true }));
        }

        this.registerRoutes();
    }

    public getApp(): Express {
        return this.app;
    }

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

        this.app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
            const message = err instanceof Error ? err.message : "Unexpected OAuth API error";
            res.status(500).send(message);
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

    private wrap(
        handler: (req: Request, res: Response) => Promise<void>,
    ): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            handler(req, res).catch(next);
        };
    }
}
