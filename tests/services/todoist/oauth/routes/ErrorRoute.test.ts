import { ErrorRoute } from "../../../../../src/services/todoist/oauth/routes/ErrorRoute";

const mockTodoistApiClient = {} as any;
let route: ErrorRoute;

beforeEach(() => {
  route = new ErrorRoute(mockTodoistApiClient);
});

describe("ErrorRoute", () => {
  it("Constructor should keep the provided error endpoint", () => {
    // Assert
    expect(route).toBeDefined();
    expect(route.path).toBe("/oauth/error");
  });

  describe("handle", () => {
    it("should respond with 400 and the error reason from query", async () => {
      // Arrange
      const req = {
        query: { reason: "some error" },
      } as any;
      const res = {
        status: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any;

      // Act
      await route.handle(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining(req.query.reason),
      );
    });
  });
});
