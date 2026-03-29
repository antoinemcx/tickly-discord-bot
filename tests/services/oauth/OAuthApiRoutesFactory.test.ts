import {
    OAuthCallbackRoute,
    OAuthErrorRoute,
    OAuthSuccessRoute
} from "../../../src/services/oauth/OAuthApiRoutesFactory";

describe("OAuthCallbackRoute", () => {
    test("should point to the correct path", () => {
        // Arrange
        const route = new (class extends OAuthCallbackRoute {
            public async handle(): Promise<void> {
                // No-op for testing
            }
        })();

        // Act
        const path = route.path;
        const method = route.method;

        // Assert
        expect(path).toBe("/oauth/callback");
        expect(method).toBe("get");
    });
});

describe("OAuthSuccessRoute", () => {
    test("should point to the correct path", () => {
        // Arrange
        const route = new (class extends OAuthSuccessRoute {
            public async handle(): Promise<void> {
                // No-op for testing
            }
        })();

        // Act
        const path = route.path;
        const method = route.method;

        // Assert
        expect(path).toBe("/oauth/success");
        expect(method).toBe("get");
    });

});

describe("OAuthErrorRoute", () => {
    test("should point to the correct path", () => {
        // Arrange
        const route = new (class extends OAuthErrorRoute {
            public async handle(): Promise<void> {
                // No-op for testing
            }
        })();

        // Act
        const path = route.path;
        const method = route.method;

        // Assert
        expect(path).toBe("/oauth/error");
        expect(method).toBe("get");
    });
});