import { TodoistOAuthRoutesFactory } from "../../../../src/services/todoist/oauth/TodoistOAuthRoutesFactory";

let factory: TodoistOAuthRoutesFactory;
beforeAll(() => {
  // Arrange
  const mockTodoistApiClient = {} as any;
  factory = new TodoistOAuthRoutesFactory(mockTodoistApiClient);
});

describe("TodoistOAuthRoutesFactory", () => {
  it("createCallbackRoute should create a callback route", () => {
    // Act
    const callbackRoute = factory.createCallbackRoute();
    // Assert
    expect(callbackRoute).toBeDefined();
    expect(callbackRoute.path).toBe("/oauth/callback");
  });

  it("createSuccessRoute should create a success route", () => {
    // Act
    const successRoute = factory.createSuccessRoute();
    // Assert
    expect(successRoute).toBeDefined();
    expect(successRoute.path).toBe("/oauth/success");
  });

  it("createErrorRoute should create an error route", () => {
    // Act
    const errorRoute = factory.createErrorRoute();
    // Assert
    expect(errorRoute).toBeDefined();
    expect(errorRoute.path).toBe("/oauth/error");
  });

  it("createAdditionalRoutes should return an empty array", () => {
    // Act
    const additionalRoutes = factory.createAdditionalRoutes();
    // Assert
    expect(additionalRoutes.length).toBe(0);
  });
});
