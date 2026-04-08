import type { DbOptions } from "@database/DrizzleDatabase";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { Pool as Pool2 } from "mysql2";
import type { Pool } from "mysql2/promise";
import { DrizzleDatabase } from "@database/DrizzleDatabase";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";

let dbMock: DrizzleDatabase;
let poolMock: Pool;
let connectionMock: MySql2Database<any>;

const configMock: DbOptions = {
  host: "localhost",
  user: "root",
  password: "password",
  database: "db",
};

jest.mock("drizzle-orm/mysql2", () => ({
  drizzle: jest.fn(),
}));

jest.mock("mysql2/promise", () => ({
  createPool: jest.fn(),
}));

beforeEach(async () => {
  jest.clearAllMocks();

  // Arrange
  poolMock = {
    end: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn(),
  } as any as Pool;

  connectionMock = {
    select: jest.fn(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
  } as any as MySql2Database<any>;

  (createPool as jest.MockedFunction<typeof createPool>).mockReturnValue(poolMock);
  (drizzle as jest.MockedFunction<typeof drizzle>).mockReturnValue(
    connectionMock as MySql2Database<Record<string, unknown>> & { $client: Pool2 },
  );

  dbMock = await DrizzleDatabase.connect(configMock); // test fixture
});

describe("DrizzleDatabase", () => {
  describe("Constructor", () => {
    it("should create with valid configuration", async () => {
      // Act
      const result = DrizzleDatabase.connect(configMock);

      // Assert
      expect(result).resolves.not.toThrow();
      expect(createPool).toHaveBeenCalledWith(configMock);
      expect(drizzle).toHaveBeenCalledWith(poolMock, {
        schema: expect.anything(),
        mode: "default",
      });
    });

    it("should reject with invalid configuration", async () => {
      // Arrange
      const invalidConfig: DbOptions = {
        host: "invalidHost",
        user: "invalidUser",
        password: "invalidPassword",
        database: "invalidDB",
      };
      (createPool as jest.Mock).mockImplementation(() => {
        throw new Error("Connection failed");
      });

      // Act
      const result = DrizzleDatabase.connect(invalidConfig);

      // Assert
      expect(result).rejects.toThrow(Error);
    });

    it("should reject with empty configuration", async () => {
      // Arrange
      const emptyConfig: DbOptions = {
        host: "",
        user: "",
        password: "",
        database: "",
      };
      jest.resetModules();

      // Act
      const result = DrizzleDatabase.connect(emptyConfig);

      // Assert
      await expect(result).rejects.toThrow(Error);

      /* Reapply the createPool mock after the test */
      jest.mock("mysql2/promise", () => ({
        createPool: jest.fn().mockImplementation(() => ({
          end: jest.fn().mockResolvedValue(undefined),
        })),
      }));
    });
  });

  describe("close", () => {
    it("should close the database connection pool", async () => {
      // Act & Assert
      expect(async () => await dbMock.close()).not.toThrow();
      expect(poolMock.end).toHaveBeenCalled();
    });

    it("should throw if there is no connection pool", async () => {
      // Arrange
      (dbMock as any).pool = null;

      // Act & Assert
      expect(async () => await dbMock.close()).rejects.toThrow();
    });
  });

  describe("getConnection", () => {
    it("should return the database connection", async () => {
      // Act
      const connection = dbMock.getConnection();
      // Assert
      expect(connection).toBe(connectionMock);
    });
  });
});
