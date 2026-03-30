import { AuthenticationErrors } from "../../../../../src/services/todoist/oauth/AuthenticationErrors";
import { CallbackRoute } from "../../../../../src/services/todoist/oauth/routes/CallbackRoute";

const mockTodoistApiClient = {} as any;
const validReq = {
    query: { code: "valid_code", state: "valid_state" }
} as any;
let route: CallbackRoute;

beforeEach(() => {
    // Arrange
    route = new CallbackRoute(mockTodoistApiClient);
});

describe("CallbackRoute", () => {
    test("Constructor should keep the provided callback endpoint", () => {
        // Assert
        expect(route).toBeDefined();
        expect(route.path).toBe("/oauth/callback");
    });

    describe("handle", () => {
        test("should redirect to error if error query parameter is present", async () => {
            // Arrange
            const req = {
                query: { error: "some error" }
            } as any;
            const res = { redirect: jest.fn() } as any;

            // Act
            await route.handle(req, res);

            // Assert
            expect(res.redirect)
                .toHaveBeenCalledWith("/oauth/error?reason=some%20error");
        });

        test("should redirect to error if the OAuth code is missing", async () => {
            // Arrange
            const req = {
                query: { state: "12345678abcdef" }
            } as any;
            const res = { redirect: jest.fn() } as any;
            const expectedError = AuthenticationErrors.INVALID_CALLBACK_QUERY;

            // Act
            await route.handle(req, res);

            // Assert
            expect(res.redirect)
                .toHaveBeenCalledWith(`/oauth/error?reason=${expectedError}`);
        });

        test("should redirect to error if the OAuth state is missing", async () => {
            // Arrange
            const req = {
                query: { code: "valid_code" }
            } as any;
            const res = { redirect: jest.fn() } as any;
            const expectedError = AuthenticationErrors.INVALID_CALLBACK_QUERY;

            // Act
            await route.handle(req, res);

            // Assert
            expect(res.redirect)
                .toHaveBeenCalledWith(`/oauth/error?reason=${expectedError}`);
        });

        test("should redirect to error if no user session matches the provided state", async () => {
            // Arrange
            const req = {
                query: { code: "valid_code", state: "nonexistent_state" }
            } as any;
            const res = { redirect: jest.fn() } as any;
            mockTodoistApiClient.getSessionByOAuthState
                = jest.fn().mockResolvedValue(undefined);
            const expectedError = AuthenticationErrors.INVALID_OAUTH_STATE;

            // Act
            await route.handle(req, res);

            // Assert
            expect(res.redirect)
                .toHaveBeenCalledWith(`/oauth/error?reason=${expectedError}`);
        });

        test("should redirect to error if user state expired", async () => {
            // Arrange
            const req = {
                query: { code: "valid_code", state: "expired_state" }
            } as any;
            const res = { redirect: jest.fn() } as any;
            mockTodoistApiClient.getSessionByOAuthState
                = jest.fn().mockResolvedValue({
                    userId: "user123",
                    expiresAt: new Date(Date.now() - 5000),
                });
            mockTodoistApiClient.clearUserSession = jest.fn();
            const expectedError = AuthenticationErrors.EXPIRED_OAUTH_STATE;

            // Act
            await route.handle(req, res);

            // Assert
            expect(res.redirect)
                .toHaveBeenCalledWith(`/oauth/error?reason=${expectedError}`);
            expect(mockTodoistApiClient.clearUserSession).toHaveBeenCalled();
        });

        test("should redirect to error if token exchange fails", async () => {
            // Arrange
            const res = { redirect: jest.fn() } as any;
            mockTodoistApiClient.getSessionByOAuthState
                = jest.fn().mockResolvedValue({ userId: "user123" });
            mockTodoistApiClient.consumeState = jest.fn().mockResolvedValue(undefined);
            mockTodoistApiClient.exchangeOAuthCodeForAccessToken
                = jest.fn().mockRejectedValue(new Error("Token exchange failed"));
            const expectedError = AuthenticationErrors.TOKEN_EXCHANGE_FAILED;

            // Act
            await route.handle(validReq, res);

            // Assert
            expect(res.redirect)
                .toHaveBeenCalledWith(`/oauth/error?reason=${expectedError}`);
        });

        test("should redirect to success if everything is valid", async () => {
            // Arrange
            const res = { redirect: jest.fn() } as any;

            mockTodoistApiClient.getSessionByOAuthState
                = jest.fn().mockResolvedValue({ userId: "user123" });
            mockTodoistApiClient.consumeState = jest.fn().mockResolvedValue(undefined);
            mockTodoistApiClient.exchangeOAuthCodeForAccessToken
                = jest.fn().mockResolvedValue("access_token_abc");
            mockTodoistApiClient.registerUserAccessToken
                = jest.fn().mockResolvedValue(undefined);
            const expectedRedirect = `/oauth/success`;

            // Act
            await route.handle(validReq, res);

            // Assert
            expect(res.redirect).toHaveBeenCalledWith(expectedRedirect);
        });
    });
});