import type { Configuration } from "./schema";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { configSchema } from "./schema";

/**
 * Resolves the path to config.json based on the runtime environment.
 * - Docker: /app/build/config.json (mountable volume)
 * - Local development: project root config.json
 */
function resolveConfigPath(): string {
  const prodPath = "/app/build/config.json";
  if (existsSync(prodPath)) {
    return prodPath;
  }

  const devPath = resolve(__dirname, "..", "..", "..", "config.json");
  return devPath;
}

/**
 * Loads and validates the configuration from config file.
 * @throws {Error} if config.json is missing or validation fails
 */
function loadConfig(): Configuration {
  const configPath = resolveConfigPath();

  if (!existsSync(configPath)) {
    throw new Error(
      `Configuration file not found at '${configPath}'.\n`
      + "Please copy 'config.example.json' to 'config.json' and fill in your values.",
    );
  }

  let rawJson: unknown;
  try {
    const fileContent = readFileSync(configPath, "utf-8");
    rawJson = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(
      `Failed to parse config.json: ${(error as Error).message}\n`
      + "Ensure the file contains valid JSON.",
    );
  }

  const result = configSchema.safeParse(rawJson);
  if (!result.success) {
    const issues = result.error.issues
      .map(issue => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid configuration in config.json:\n${issues}\n`
      + "Please check your config.json against config.example.json.",
    );
  }

  return result.data;
}

/** Singleton configuration instance loaded at module import. */
export const config: Configuration = loadConfig();
