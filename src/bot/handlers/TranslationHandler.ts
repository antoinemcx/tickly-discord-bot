import type { LocalizationMap } from "discord.js";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { displayInfo, displaySuccess, pink } from "@src/utils/logger";
import { Locale } from "discord.js";
import { Handler } from "./Handler";

type TranslationFiles = Map<string, TranslationDictionary>;

interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

/**
 * Handles loading language files and translations from those files.
 */
export class TranslationHandler extends Handler {
  public static readonly languageFilesPath = join(__dirname, "..", "languages");
  public static readonly MISSING_TRANSLATION_MESSAGE
    = "Missing translation for ";

  /**
   * Stored translations with the translation types (common, commands, etc.)
   * and the translation key of each translation locale folder.
   */
  private readonly translations: Map<Locale, TranslationFiles> = new Map();

  public async setup(): Promise<void> {
    displayInfo("Loading language directories...");
    const languageDirs = readdirSync(TranslationHandler.languageFilesPath);

    if (languageDirs) {
      for (const language of languageDirs) {
        if (!this.isSupportedLocale(language)) {
          throw new Error(`Invalid language locale '${language}'`);
        }
        this.loadTranslationFiles(language);
      };

      const localesFormatted = Array.from(this.translations.keys())
        .map(locale => pink(locale))
        .join(", ");
      displaySuccess(`${pink(this.translations.size)} translation `
        + `locales loaded : ${localesFormatted}.`);
    }
  }

  /**
   * Loads a language translation files into memory for translations.
   * @param language language for storing translations
   */
  private loadTranslationFiles(language: Locale): void {
    const languagePath = join(TranslationHandler.languageFilesPath, language);
    const languageFiles = readdirSync(languagePath);

    this.translations.set(language, new Map());
    if (!languageFiles.every(file => file.endsWith(".json"))) {
      throw new Error("The " + language
        + " directory contain more than just json files.");
    }

    for (const file of languageFiles) {
      const filePath = join(languagePath, file);
      const fileContent = JSON.parse(readFileSync(filePath, "utf8"));
      const fileName = file.replace(".json", "");

      this.translations.get(language)!.set(fileName, fileContent);
    }
  }

  /** @returns language locales that have stored translations */
  public getLocales(): Locale[] {
    return this.translations ? Array.from(this.translations.keys()) : [];
  }

  /**
   * Checks whether a locale string is a supported Discord locale.
   * @param locale locale string to validate.
   * @returns true when the locale is a valid Locale enum value.
   */
  public isSupportedLocale(locale: string): locale is Locale {
    return Object.values(Locale).includes(locale as Locale);
  }

  /**
   * Retrieves the default locale of the bot from its configuration file.
   * @returns the default locale if it's valid and supported, or the first
   *          supported locale as a fallback.
   */
  public getDefaultLocale(): Locale {
    const defaultLocale
      = this.client?.getConfig()?.defaultLocale as Locale | undefined;

    return defaultLocale && this.isSupportedLocale(defaultLocale)
      ? defaultLocale
      : this.getLocales()[0];
  }

  /**
   * Translates a text from the <language>/common.json file.
   * @param language language code
   * @param translationKey identifier in the translation file
   * @param parameters optional parameters for placeholders
   * @returns Translated text or a fallback if translation is missing
   */
  public translateCommon(
    language: Locale,
    translationKey: string,
    parameters: Record<string, string> = {},
  ): string {
    const translated: string = this.getNestedProperty(
      this.translations.get(language)?.get("common"),
      translationKey,
    ) || TranslationHandler.MISSING_TRANSLATION_MESSAGE + translationKey;

    return this.replaceParameters(translated, parameters);
  }

  /**
   * Translates a text from the <language>/commands.json file.
   * @param language language code
   * @param command name of the command the text is originated
   * @param translationKey identifier in the translation file
   * @param parameters optional parameters for placeholders
   * @returns translated text or a fallback if translation is missing
   */
  public translateCommand(
    language: Locale,
    command: string,
    translationKey: string,
    parameters: Record<string, string> = {},
  ): string {
    const translated: string = this.getNestedProperty(
      this.translations.get(language)?.get("commands"),
      `${command}.${translationKey}`,
    ) || TranslationHandler.MISSING_TRANSLATION_MESSAGE + translationKey;

    return this.replaceParameters(translated, parameters);
  }

  /**
   * Collects every available command name for a command across locales.
   * Locales without a name are omitted from the returned object.
   *
   * @param command translation name of the command
   * @returns an object keyed by locale with the translated name
   */
  public getCommandNames(command: string): LocalizationMap {
    return this.getCommandLocalizations(command, "name");
  }

  /**
   * Collects every available command description for a command across locales.
   * Locales without a description are omitted from the returned object.
   *
   * @param command name of the command
   * @returns an object keyed by locale with the translated description
   */
  public getCommandDescriptions(command: string): LocalizationMap {
    return this.getCommandLocalizations(command, "description");
  }

  /**
   * Collects a specific localized property for a command across all locales.
   * Locales without the property are omitted from the returned object.
   *
   * @param command name of the command
   * @param property the property key to retrieve (e.g. "name" or "description")
   * @returns an object keyed by locale with the translated value
   */
  private getCommandLocalizations(
    command: string,
    property: string,
  ): LocalizationMap {
    const localizations: LocalizationMap = {};

    for (const [locale, files] of this.translations.entries()) {
      const value = this.getNestedProperty(
        files.get("commands"),
        `${command}.${property}`,
      );

      if (typeof value === "string" && value.trim().length > 0) {
        localizations[locale] = this.replaceParameters(value, {});
      }
    }

    return localizations;
  }

  /**
   * Retrieves a nested property from an object using a dot-separated key.
   * @param data the object to retrieve the property from
   * @param nestedKey the dot-separated key
   * @returns the value of the nested property, or undefined if any part
   *          of the path is missing
   */
  private getNestedProperty(
    data: TranslationDictionary | undefined,
    nestedKey: string,
  ): string | undefined {
    const keys: string[] = nestedKey.split(".");
    let nestedProperty: any = data;
    if (!nestedProperty) {
      return undefined;
    }

    for (let keyIndex = 0;
      nestedProperty !== undefined && keyIndex < keys.length;
      keyIndex++) {
      nestedProperty = nestedProperty[keys[keyIndex]];
    }

    return nestedProperty;
  }

  /**
   * Replaces JSON placeholders in a translated text.
   *
   * Placeholders are in the format {{ parameterName }} and can be used for
   * both parameters, provided in the parameters param, and emotes defined in
   * the bot config.
   *
   * @param translatedText the translated text with placeholders.
   * @param parameters record containing placeholder values.
   * @returns translated text with placeholders replaced.
   */
  private replaceParameters(
    translatedText: string,
    parameters: Record<string, string>,
  ): string {
    return translatedText.replace(/\{\{(.*?)\}\}/g, (_match, parameter) => {
      const trimmedParameter = parameter.trim();
      if (parameters[trimmedParameter]) { // parameter provided
        return parameters[trimmedParameter];
      }

      const emotes = this.client?.getConfig()?.emotes;
      if (emotes) { // emote parameter (supports nested emojis)
        const keys: string[] = trimmedParameter.split(".");
        const value = keys.reduce<unknown>(
          (acc, key) => acc !== null && typeof acc === "object" && key in acc
            ? (acc as Record<string, unknown>)[key]
            : undefined,
          emotes,
        );
        if (typeof value === "string") {
          return value;
        }
      }

      return ""; // no parameter provided
    });
  }
}
