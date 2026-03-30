import { TodoistOAuthRoutesFactory } from "../../../../src/services/todoist/oauth/TodoistOAuthRoutesFactory";

let factory: TodoistOAuthRoutesFactory;
beforeAll(() => {
    // Arrange
    const mockTodoistApiClient = {} as any;
    factory = new TodoistOAuthRoutesFactory(mockTodoistApiClient);
});

describe("TodoistOAuthRoutesFactory", () => {
    test("createCallbackRoute should create a callback route", () => {
        // Act
        const callbackRoute = factory.createCallbackRoute();
        // Assert
        expect(callbackRoute).toBeDefined();
        expect(callbackRoute.path).toBe("/oauth/callback");
    });
    
    test("createSuccessRoute should create a success route", () => {
        // Act
        const successRoute = factory.createSuccessRoute();
        // Assert
        expect(successRoute).toBeDefined();
        expect(successRoute.path).toBe("/oauth/success");
    });

    test("createErrorRoute should create an error route", () => {
        // Act
        const errorRoute = factory.createErrorRoute();
        // Assert
        expect(errorRoute).toBeDefined();
        expect(errorRoute.path).toBe("/oauth/error");
    });

    test("createAdditionalRoutes should return an empty array", () => {
        // Act
        const additionalRoutes = factory.createAdditionalRoutes();
        // Assert
        expect(additionalRoutes.length).toBe(0);
    });
});