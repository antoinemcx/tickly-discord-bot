import { UserSession, UserSessionStatus } from "../../../../src/services/todoist/sessions/UserSession";

describe("UserSession", () => {
    it("should create", () => {
        // Arrange
        const userId = "user123";
        const status = UserSessionStatus.Pending;
        const oauthState = "random-oauth-state";
        const accessToken = null;
        const expiresAt = null;

        // Act
        const session = new UserSession(
            userId, status, oauthState, accessToken, expiresAt);

        // Assert
        expect(session.userId).toBe("user123");
        expect(session.status).toBe(UserSessionStatus.Pending);
        expect(session.oauthState).toBe("random-oauth-state");
        expect(session.accessToken).toBeNull();
        expect(session.expiresAt).toBeNull();
    });
});