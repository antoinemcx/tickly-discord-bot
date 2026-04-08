import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  verbose: true,
  strict: true,
});
