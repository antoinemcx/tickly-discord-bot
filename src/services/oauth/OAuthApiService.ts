import type { ApiRoute } from "@services/apiBuilder/ApiRoute";
import type { Express } from "express";
import { join } from "node:path";
import { ApiService } from "@services/apiBuilder/ApiService";
import express from "express";

/**
 * OAuth API service. Registers the callback route and serves static
 * assets under `/assets/`.
 */
export class OAuthApiService extends ApiService {
  /**
   * Creates a new OAuth web service and registers routes.
   * @param callbackRoute the mandatory OAuth callback handler
   * @param additionalRoutes optional extra routes
   * @param app optional Express app instance if one already exists
   */
  constructor(callbackRoute: ApiRoute, additionalRoutes: ApiRoute[] = [], app?: Express) {
    super(app);

    this.app.use("/assets", express.static(join(__dirname, "assets")));
    this.setupRoutes([callbackRoute], additionalRoutes);
  }
}
