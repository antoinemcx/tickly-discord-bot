import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

/**
 * Loads and provides translations from a directory of JSON locale files.
 * One file per locale, named after the locale code (e.g. `en-US.json`).
 */
export class TranslationLoader {
  private static readonly FALLBACK_LOCALE = "en-US";

  private readonly translations = new Map<string, TranslationDictionary>();

  /**
   * Creates a new loader and immediately reads all locale JSON files from disk.
   *
   * @param languagesDir absolute path to the directory containing locale files
   * @throws {Error} if the directory is missing or any file is unreadable
   */
  public constructor(private readonly languagesDir: string) {
    this.loadAll();
  }

  /**
   * Returns the translated string for the given locale and dot-separated key.
   * Falls back to en-US when the locale is not loaded, and to the key itself
   * as a last resort.
   *
   * @param locale language code, e.g. "fr" or "en-US"
   * @param key dot-separated translation key, e.g. "error.reasons.expired_oauth_state"
   * @returns translated string, or the key when no translation is available
   */
  public translate(locale: string, key: string): string {
    return this.lookup(locale, key)
      ?? this.lookup(TranslationLoader.FALLBACK_LOCALE, key)
      ?? key;
  }

  /**
   * Returns the translated string for the given locale and key, or undefined
   * when the key is not found in the requested locale or the fallback.
   *
   * @param locale language code
   * @param key dot-separated translation key
   * @returns translated string, or undefined if not found
   */
  public translateOptional(locale: string, key: string): string | undefined {
    return this.lookup(locale, key)
      ?? this.lookup(TranslationLoader.FALLBACK_LOCALE, key);
  }

  private loadAll(): void {
    const files = readdirSync(this.languagesDir).filter(f => f.endsWith(".json"));

    for (const file of files) {
      const locale = file.replace(".json", "");
      const content = JSON.parse(
        readFileSync(join(this.languagesDir, file), "utf8"),
      ) as TranslationDictionary;
      this.translations.set(locale, content);
    }
  }

  private lookup(locale: string, key: string): string | undefined {
    const dict = this.translations.get(locale);
    if (!dict) return undefined;

    const parts = key.split(".");
    let current: unknown = dict;

    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return typeof current === "string" ? current : undefined;
  }
}
