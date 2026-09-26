import type { TranslationLoader } from "@services/apiBuilder/TranslationLoader";
import type { OAuthPageRenderer } from "@services/oauth/OAuthPageRenderer";
import { AuthenticationErrors } from "@services/todoist/oauth/AuthenticationErrors";
import { CallbackRoute } from "@services/todoist/oauth/CallbackRoute";

const mockSuccessHtml = "<html>success</html>";
const mockErrorHtml = "<html>error</html>";
const mockRenderer = {
  renderSuccess: jest.fn().mockReturnValue(mockSuccessHtml),
  renderError: jest.fn().mockReturnValue(mockErrorHtml),
} as unknown as OAuthPageRenderer;
const mockLoader = {} as unknown as TranslationLoader;
const mockTodoistApiClient = {} as any;

const validReq = {
  query: { code: "valid_code", state: "valid_state" },
} as any;

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    send: jest.fn(),
  } as any;
}

let route: CallbackRoute;

beforeEach(() => {
  jest.clearAllMocks();
  route = new CallbackRoute(mockTodoistApiClient, mockRenderer, mockLoader);
});

describe("CallbackRoute", () => {
  it("Constructor should keep the provided callback endpoint", () => {
    // Assert
    expect(route).toBeDefined();
    expect(route.path).toBe("/oauth/callback");
  });

  describe("handle", () => {
    it("should render an error page if error query parameter is present", async () => {
      // Arrange
      const req = { query: { error: "some error" } } as any;
      const res = makeRes();

      // Act
      await route.handle(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.type).toHaveBeenCalledWith("html");
      expect(mockRenderer.renderError).toHaveBeenCalledWith("en-US", "some error", mockLoader);
      expect(res.send).toHaveBeenCalledWith(mockErrorHtml);
    });

    it("should render an error page if the OAuth code is missing", async () => {
      // Arrange
      const req = { query: { state: "12345678abcdef" } } as any;
      const res = makeRes();

      // Act
      await route.handle(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockRenderer.renderError).toHaveBeenCalledWith(
        "en-US",
        AuthenticationErrors.INVALID_CALLBACK_QUERY,
        mockLoader,
      );
    });

    it("should render an error page if the OAuth state is missing", async () => {
      // Arrange
      const req = { query: { code: "valid_code" } } as any;
      const res = makeRes();

      // Act
      await route.handle(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockRenderer.renderError).toHaveBeenCalledWith(
        "en-US",
        AuthenticationErrors.INVALID_CALLBACK_QUERY,
        mockLoader,
      );
    });

    it("should render an error page if no user session matches the provided state", async () => {
      // Arrange
      const req = { query: { code: "valid_code", state: "nonexistent_state" } } as any;
      const res = makeRes();
      mockTodoistApiClient.getSessionByOAuthState = jest.fn().mockResolvedValue(undefined);

      // Act
      await route.handle(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockRenderer.renderError).toHaveBeenCalledWith(
        "en-US",
        AuthenticationErrors.INVALID_OAUTH_STATE,
        mockLoader,
      );
    });

    it("should render an error page if the user session has expired", async () => {
      // Arrange
      const req = { query: { code: "valid_code", state: "expired_state" } } as any;
      const res = makeRes();
      mockTodoistApiClient.getSessionByOAuthState = jest.fn().mockResolvedValue({
        userId: "user123",
        expiresAt: new Date(Date.now() - 5000),
      });
      mockTodoistApiClient.clearUserSession = jest.fn().mockResolvedValue(undefined);

      // Act
      await route.handle(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockRenderer.renderError).toHaveBeenCalledWith(
        "en-US",
        AuthenticationErrors.EXPIRED_OAUTH_STATE,
        mockLoader,
      );
      expect(mockTodoistApiClient.clearUserSession).toHaveBeenCalled();
    });

    it("should render an error page if the token exchange fails", async () => {
      // Arrange
      const res = makeRes();
      mockTodoistApiClient.getSessionByOAuthState = jest.fn().mockResolvedValue({ userId: "user123" });
      mockTodoistApiClient.exchangeOAuthCodeForAccessToken = jest
        .fn()
        .mockRejectedValue(new Error("Token exchange failed"));

      // Act
      await route.handle(validReq, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockRenderer.renderError).toHaveBeenCalledWith(
        "en-US",
        AuthenticationErrors.TOKEN_EXCHANGE_FAILED,
        mockLoader,
      );
    });

    it("should render the success page if everything is valid", async () => {
      // Arrange
      const res = makeRes();
      mockTodoistApiClient.getSessionByOAuthState = jest.fn().mockResolvedValue({ userId: "user123" });
      mockTodoistApiClient.exchangeOAuthCodeForAccessToken = jest
        .fn()
        .mockResolvedValue("access_token_abc");
      mockTodoistApiClient.registerUserAccessToken = jest.fn().mockResolvedValue(undefined);

      // Act
      await route.handle(validReq, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.type).toHaveBeenCalledWith("html");
      expect(mockRenderer.renderSuccess).toHaveBeenCalledWith("en-US", mockLoader);
      expect(res.send).toHaveBeenCalledWith(mockSuccessHtml);
    });

    it("should use the locale embedded in the state when rendering the success page", async () => {
      // Arrange
      const req = { query: { code: "valid_code", state: "csrf123|fr" } } as any;
      const res = makeRes();
      mockTodoistApiClient.getSessionByOAuthState = jest.fn().mockResolvedValue({ userId: "user123" });
      mockTodoistApiClient.exchangeOAuthCodeForAccessToken = jest
        .fn()
        .mockResolvedValue("access_token_abc");
      mockTodoistApiClient.registerUserAccessToken = jest.fn().mockResolvedValue(undefined);

      // Act
      await route.handle(req, res);

      // Assert
      expect(mockTodoistApiClient.getSessionByOAuthState).toHaveBeenCalledWith("csrf123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockRenderer.renderSuccess).toHaveBeenCalledWith("fr", mockLoader);
    });

    it("should use the locale embedded in the state when rendering an error page", async () => {
      // Arrange
      const req = { query: { code: "valid_code", state: "csrf123|fr" } } as any;
      const res = makeRes();
      mockTodoistApiClient.getSessionByOAuthState = jest.fn().mockResolvedValue(undefined);

      // Act
      await route.handle(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockRenderer.renderError).toHaveBeenCalledWith(
        "fr",
        AuthenticationErrors.INVALID_OAUTH_STATE,
        mockLoader,
      );
    });
  });
});
