import { SuccessRoute } from "@services/todoist/oauth/routes/SuccessRoute";

const mockTodoistApiClient = {} as any;
let route: SuccessRoute;

beforeEach(() => {
  route = new SuccessRoute(mockTodoistApiClient);
});

describe("SuccessRoute", () => {
  it("Constructor should keep the provided error endpoint", () => {
    // Assert
    expect(route).toBeDefined();
    expect(route.path).toBe("/oauth/success");
  });

  describe("handle", () => {
    it("should respond with 200", async () => {
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
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
