import type { DbOptions } from "@database/DrizzleDatabase";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { Pool as Pool2 } from "mysql2";
import type { Connection, Pool } from "mysql2/promise";
import { DrizzleDatabase } from "@database/DrizzleDatabase";
import { LanguageRepository } from "@database/repositories/LanguageRepository";
import * as schema from "@database/schema";
import { getTableName } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createConnection, createPool } from "mysql2/promise";

let dbMock: DrizzleDatabase;
let poolMock: Pool;
let rawConnectionMock: Connection;
let connectionMock: MySql2Database<any>;
let transactionMock: any;
const requiredTables = Object.values(schema).map(table => getTableName(table));

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
  createConnection: jest.fn(),
}));

beforeEach(async () => {
  jest.clearAllMocks();

  // Arrange
  poolMock = {
    end: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn(),
    query: jest.fn(),
  } as any as Pool;

  connectionMock = {
    select: jest.fn(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    transaction: jest.fn(),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    }),
  } as any as MySql2Database<any>;

  transactionMock = {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        onDuplicateKeyUpdate: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  (connectionMock.transaction as jest.Mock)
    .mockImplementation(async (callback: any) => callback(transactionMock));

  rawConnectionMock = {
    query: jest.fn().mockResolvedValue(undefined),
    end: jest.fn().mockResolvedValue(undefined),
  } as any as Connection;

  (createPool as jest.MockedFunction<typeof createPool>).mockReturnValue(poolMock);
  (createConnection as jest.MockedFunction<typeof createConnection>)
    .mockResolvedValue(rawConnectionMock);
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

  describe("initializeBaseData", () => {
    it("should verify tables before seeding", async () => {
      // Arrange
      const assertSpy = jest.spyOn(dbMock, "assertTablesExist").mockResolvedValueOnce();
      const seedSpy = jest.spyOn(dbMock, "seedTables").mockResolvedValueOnce();

      // Act
      await dbMock.initializeBaseData();

      // Assert
      expect(assertSpy).toHaveBeenCalledTimes(1);
      expect(seedSpy).toHaveBeenCalledTimes(1);
      expect(assertSpy.mock.invocationCallOrder[0])
        .toBeLessThan(seedSpy.mock.invocationCallOrder[0]);
    });
  });

  describe("assertTablesExist", () => {
    it("should resolve when all required tables exist", async () => {
      // Arrange
      (poolMock.query as jest.Mock).mockResolvedValueOnce([
        requiredTables.map(tableName => ({ tableName })),
      ]);

      // Act
      const result = dbMock.assertTablesExist();

      // Assert
      await expect(result).resolves.not.toThrow();
      expect(poolMock.query).toHaveBeenCalledWith(
        expect.stringContaining("table_name IN"),
        requiredTables,
      );
    });

    it("should reject when one required table is missing", async () => {
      // Arrange
      (poolMock.query as jest.Mock).mockResolvedValueOnce([
        requiredTables.slice(0, -1).map(tableName => ({ tableName })),
      ]);

      // Act
      const result = dbMock.assertTablesExist();

      // Assert
      await expect(result).rejects.toThrow();
    });

    it("should reject when more than one required table is missing", async () => {
      // Arrange
      (poolMock.query as jest.Mock).mockResolvedValueOnce([
        requiredTables.slice(0, -2).map(tableName => ({ tableName })),
      ]);

      // Act
      const result = dbMock.assertTablesExist();

      // Assert
      await expect(result).rejects.toThrow();
    });

    it("should reject when table verification query fails", async () => {
      // Arrange
      (poolMock.query as jest.Mock).mockRejectedValueOnce(
        new Error("metadata failed"),
      );
      // Act
      const result = dbMock.assertTablesExist();
      // Assert
      await expect(result).rejects.toThrow("Failed to verify database schema tables");
    });
  });

  describe("seedTables", () => {
    it("should upsert base languages", async () => {
      // Act
      const result = dbMock.seedTables();

      // Assert
      await expect(result).resolves.not.toThrow();
      expect(connectionMock.transaction).toHaveBeenCalledTimes(1);
      expect(transactionMock.insert).toHaveBeenCalledTimes(3);
    });

    it("should add at least one language within the transaction", async () => {
      // Arrange
      const addLanguageSpy = jest
        .spyOn(LanguageRepository.prototype, "addLanguage")
        .mockResolvedValue(undefined);

      // Act
      await dbMock.seedTables();

      // Assert
      expect(addLanguageSpy).toHaveBeenCalled();
      expect(addLanguageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ code: expect.any(String) }),
        transactionMock,
      );
    });

    it("should reject when seeding query fails", async () => {
      // Arrange
      (connectionMock.transaction as jest.Mock).mockRejectedValueOnce(
        new Error("seed failed"),
      );

      // Act
      const result = dbMock.seedTables();

      // Assert
      await expect(result).rejects.toThrow("Failed to seed base configuration data");
    });
  });

  describe("ensureDatabaseExists", () => {
    it("should create the database if it does not exist", async () => {
      // Act
      await DrizzleDatabase.ensureDatabaseExists(configMock);

      // Assert
      expect(createConnection).toHaveBeenCalledWith({
        host: configMock.host,
        user: configMock.user,
        password: configMock.password,
      });
      expect(rawConnectionMock.query).toHaveBeenCalledWith(
        `CREATE DATABASE IF NOT EXISTS \`${configMock.database}\``,
      );
      expect(rawConnectionMock.end).toHaveBeenCalled();
    });

    it("should close the connection even when query fails", async () => {
      // Arrange
      (rawConnectionMock.query as jest.Mock).mockRejectedValueOnce(
        new Error("access denied"),
      );

      // Act & Assert
      await expect(DrizzleDatabase.ensureDatabaseExists(configMock))
        .rejects
        .toThrow("Failed to ensure database exists");
      expect(rawConnectionMock.end).toHaveBeenCalled();
    });

    it("should throw when database name is empty", async () => {
      // Arrange
      const emptyDbConfig: DbOptions = { ...configMock, database: "  " };

      // Act & Assert
      await expect(DrizzleDatabase.ensureDatabaseExists(emptyDbConfig))
        .rejects
        .toThrow("Database name is required.");
    });

    it("should throw when connection fails", async () => {
      // Arrange
      (createConnection as jest.Mock).mockRejectedValueOnce(
        new Error("ECONNREFUSED"),
      );

      // Act & Assert
      await expect(DrizzleDatabase.ensureDatabaseExists(configMock))
        .rejects
        .toThrow("Failed to ensure database exists");
    });
  });
});
