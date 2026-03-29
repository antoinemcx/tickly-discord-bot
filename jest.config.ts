import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  clearMocks: true,
  collectCoverage: false,
  // coverageDirectory: "./coverage",
  // coverageProvider: "v8",
};

export default config;
