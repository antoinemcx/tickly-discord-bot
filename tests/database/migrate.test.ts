import type { DbOptions } from "@database/DrizzleDatabase";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { DrizzleDatabase } from "@database/DrizzleDatabase";
import { runMigrations } from "@database/migrate";
import { migrate } from "drizzle-orm/mysql2/migrator";

jest.mock("drizzle-orm/mysql2/migrator", () => ({
  migrate: jest.fn().mockResolvedValue(undefined),
}));

const connectionMock = {} as MySql2Database<any>;
const dbMock = {
  getConnection: jest.fn().mockReturnValue(connectionMock),
  close: jest.fn().mockResolvedValue(undefined),
} as unknown as DrizzleDatabase;

jest.spyOn(DrizzleDatabase, "connect").mockResolvedValue(dbMock);

const configMock: DbOptions = {
  host: "localhost",
  user: "root",
  password: "password",
  database: "testdb",
};

describe("runMigrations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (DrizzleDatabase.connect as jest.Mock).mockResolvedValue(dbMock);
  });

  it("should connect, run migrations and close the connection", async () => {
    // Act
    await runMigrations(configMock);

    // Assert
    expect(DrizzleDatabase.connect).toHaveBeenCalledWith(configMock);
    expect(migrate).toHaveBeenCalledWith(connectionMock, {
      migrationsFolder: expect.stringContaining("migrations"),
    });
    expect(dbMock.close).toHaveBeenCalled();
  });

  it("should close the connection when migration fails", async () => {
    // Arrange
    (migrate as jest.Mock).mockRejectedValueOnce(new Error("migration error"));

    // Act & Assert
    await expect(runMigrations(configMock)).rejects.toThrow("migration error");
    expect(dbMock.close).toHaveBeenCalled();
  });

  it("should throw when database connection fails", async () => {
    // Arrange
    (DrizzleDatabase.connect as jest.Mock).mockRejectedValueOnce(
      new Error("connection refused"),
    );

    // Act & Assert
    await expect(runMigrations(configMock)).rejects.toThrow("connection refused");
  });
});
