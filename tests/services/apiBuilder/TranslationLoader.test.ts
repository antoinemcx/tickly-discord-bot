import { join } from "node:path";
import { TranslationLoader } from "@services/apiBuilder/TranslationLoader";

const LANGUAGES_DIR = join(process.cwd(), "src", "services", "oauth", "languages");

let loader: TranslationLoader;

beforeEach(() => {
  loader = new TranslationLoader(LANGUAGES_DIR);
});

describe("TranslationLoader", () => {
  describe("translate", () => {
    it("should return the translated string for a known locale and key", () => {
      // Act
      const result = loader.translate("en-US", "success.title");
      // Assert
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toBe("success.title");
    });

    it("should return a different string for the same key in a different locale", () => {
      // Act
      const enResult = loader.translate("en-US", "success.title");
      const frResult = loader.translate("fr", "success.title");
      // Assert
      expect(enResult).not.toBe(frResult);
    });

    it("should fall back to en-US for an unknown locale", () => {
      // Act
      const fallback = loader.translate("en-US", "success.title");
      const result = loader.translate("xx-UNKNOWN", "success.title");
      // Assert
      expect(result).toBe(fallback);
    });

    it("should return the key itself when it does not exist in any locale", () => {
      // Arrange
      const missingKey = "this.key.does.not.exist";
      // Act
      const result = loader.translate("en-US", missingKey);
      // Assert
      expect(result).toBe(missingKey);
    });

    it("should return a translated error reason string", () => {
      // Act
      const result = loader.translate("en-US", "error.reasons.expired_oauth_state");
      // Assert
      expect(typeof result).toBe("string");
      expect(result).not.toBe("error.reasons.expired_oauth_state");
    });
  });

  describe("translateOptional", () => {
    it("should return the translated string for a known key", () => {
      // Act
      const result = loader.translateOptional("en-US", "error.title");
      // Assert
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should return undefined for a key that does not exist in any locale", () => {
      // Act
      const result = loader.translateOptional("en-US", "error.reasons.nonexistent_reason");
      // Assert
      expect(result).toBeUndefined();
    });

    it("should fall back to en-US value for an unknown locale with a known key", () => {
      // Act
      const enResult = loader.translateOptional("en-US", "error.title");
      const result = loader.translateOptional("xx-UNKNOWN", "error.title");
      // Assert
      expect(result).toBe(enResult);
    });
  });
});
