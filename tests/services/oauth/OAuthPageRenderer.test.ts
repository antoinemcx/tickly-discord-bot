import type { TranslationLoader } from "@services/apiBuilder/TranslationLoader";
import { OAuthPageRenderer } from "@services/oauth/OAuthPageRenderer";

const mockColors = { background: "#fafaf9", primary: "#fb2c36" };

const mockLoader: TranslationLoader = {
  translate: jest.fn((locale: string, key: string) => `[${locale}:${key}]`),
  translateOptional: jest.fn((_locale: string, _key: string) => undefined),
} as unknown as TranslationLoader;

let renderer: OAuthPageRenderer;

beforeEach(() => {
  jest.clearAllMocks();
  renderer = new OAuthPageRenderer(mockColors);
});

describe("OAuthPageRenderer", () => {
  describe("renderSuccess", () => {
    it("should return a complete HTML document", () => {
      // Act
      const html = renderer.renderSuccess("en-US", mockLoader);
      // Assert
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    it("should set the correct lang attribute", () => {
      // Act
      const html = renderer.renderSuccess("fr", mockLoader);
      // Assert
      expect(html).toContain("lang=\"fr\"");
    });

    it("should include the auto-redirect script", () => {
      // Act
      const html = renderer.renderSuccess("en-US", mockLoader);
      // Assert
      expect(html).toContain("discord:///");
      expect(html).toContain("setTimeout");
    });

    it("should include the Discord button link", () => {
      // Act
      const html = renderer.renderSuccess("en-US", mockLoader);
      // Assert
      expect(html).toContain("href=\"discord:///\"");
    });

    it("should apply the configured background and primary colors", () => {
      // Act
      const html = renderer.renderSuccess("en-US", mockLoader);
      // Assert
      expect(html).toContain(mockColors.background);
      expect(html).toContain(mockColors.primary);
    });

    it("should call translate with the correct keys", () => {
      // Act
      renderer.renderSuccess("en-US", mockLoader);
      // Assert
      expect(mockLoader.translate).toHaveBeenCalledWith("en-US", "success.title");
      expect(mockLoader.translate).toHaveBeenCalledWith("en-US", "success.description");
      expect(mockLoader.translate).toHaveBeenCalledWith("en-US", "success.button");
    });

    it("should escape HTML entities in translated strings", () => {
      // Arrange
      (mockLoader.translate as jest.Mock).mockReturnValue("<script>xss</script>");
      // Act
      const html = renderer.renderSuccess("en-US", mockLoader);
      // Assert
      expect(html).not.toContain("<script>xss</script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("renderError", () => {
    it("should return a complete HTML document", () => {
      // Act
      const html = renderer.renderError("en-US", "expired_oauth_state", mockLoader);
      // Assert
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("should not include the auto-redirect script", () => {
      // Act
      const html = renderer.renderError("en-US", "expired_oauth_state", mockLoader);
      // Assert
      expect(html).not.toContain("setTimeout");
    });

    it("should use the specific reason translation when available", () => {
      // Arrange
      const specificMessage = "Specific error message";
      (mockLoader.translateOptional as jest.Mock).mockReturnValue(specificMessage);
      // Act
      const html = renderer.renderError("en-US", "expired_oauth_state", mockLoader);
      // Assert
      expect(mockLoader.translateOptional)
        .toHaveBeenCalledWith("en-US", "error.reasons.expired_oauth_state");
      expect(html).toContain(specificMessage);
    });

    it("should fall back to unknown_error when specific reason is not found", () => {
      // Arrange
      const fallbackMessage = "Unknown error fallback";
      (mockLoader.translateOptional as jest.Mock).mockReturnValue(undefined);
      (mockLoader.translate as jest.Mock).mockImplementation((_l: string, key: string) =>
        key === "error.reasons.unknown_error" ? fallbackMessage : `[${key}]`);
      // Act
      const html = renderer.renderError("en-US", "nonexistent_reason", mockLoader);
      // Assert
      expect(html).toContain(fallbackMessage);
    });

    it("should escape HTML entities in the reason description", () => {
      // Arrange
      (mockLoader.translateOptional as jest.Mock).mockReturnValue("<img onerror=\"xss\">");
      // Act
      const html = renderer.renderError("en-US", "some_reason", mockLoader);
      // Assert
      expect(html).not.toContain("<img onerror=\"xss\">");
      expect(html).toContain("&lt;img");
    });
  });
});
