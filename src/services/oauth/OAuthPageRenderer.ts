import type { Configuration } from "@bot/Tickly";
import type { TranslationLoader } from "@services/apiBuilder/TranslationLoader";
import { displayWarning } from "@src/utils/logger";

interface PageOptions {
  lang: string;
  title: string;
  description: string;
  button: string;
  /** Raw HTML to inject before </body>. Must never derive from user input. */
  trustedBodyScript?: string;
}

/**
 * Renders self-contained HTML pages for OAuth flow results.
 * Pages are styled after the Nuxt UI error page aesthetic.
 */
export class OAuthPageRenderer {
  public constructor(private readonly colors: Configuration["oauth"]["colors"]) {
    if (!colors.background || !colors.primary) {
      displayWarning("OAuth colors missing in the configuration file.");
    }
  }

  /**
   * Renders the OAuth success page.
   * Includes an automatic redirect to Discord after 1.5 seconds.
   *
   * @param locale display language for the page
   * @param loader translation loader instance
   * @returns complete HTML string for the success page
   */
  public renderSuccess(locale: string, loader: TranslationLoader): string {
    return this.buildPage({
      lang: locale,
      title: loader.translate(locale, "success.title"),
      description: loader.translate(locale, "success.description"),
      button: loader.translate(locale, "success.button"),
      trustedBodyScript: `<script>setTimeout(function(){window.location.href="discord:///";},1500);</script>`,
    });
  }

  /**
   * Renders the OAuth error page.
   * Displays a precise message based on the error reason code.
   *
   * @param locale display language for the page
   * @param reason error reason code (e.g. "expired_oauth_state")
   * @param loader translation loader instance
   * @returns complete HTML string for the error page
   */
  public renderError(locale: string, reason: string, loader: TranslationLoader): string {
    const description = loader.translateOptional(locale, `error.reasons.${reason}`)
      ?? loader.translate(locale, "error.reasons.unknown_error");

    return this.buildPage({
      lang: locale,
      title: loader.translate(locale, "error.title"),
      description,
      button: loader.translate(locale, "error.button"),
    });
  }

  private buildPage(options: PageOptions): string {
    const { lang, title, description, button, trustedBodyScript = "" } = options;
    const { background, primary } = this.colors;

    return `<!DOCTYPE html>
<html lang="${this.escapeHTML(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/webp" href="/assets/logo.webp">
  <title>${this.escapeHTML(title)}</title>
  <style>
    @import url('https://fonts.bunny.net/css?family=geist:400,500,600');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background-color:${background};font-family:'Geist',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:16px;line-height:1.5;color:#1c1917;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:1.5rem}
    .container{max-width:650px;width:100%;text-align:center;padding:5px}
    h1{font-size:1.875rem;font-weight:600;letter-spacing:-0.025em;color:#0c0a09;margin-bottom:0.5rem}
    p{color:#78716c;margin-bottom:1.75rem;font-size:1.125rem}
    a{display:inline-flex;align-items:center;background-color:${primary};color:#ffffff;font-family:inherit;font-size:0.875rem;font-weight:500;line-height:1;padding:0.5625rem 1rem;border-radius:0.375rem;text-decoration:none;transition:opacity 0.15s ease}
    a:hover{opacity:0.85}
  </style>
</head>
<body>
  <div class="container">
    <h1>${this.escapeHTML(title)}</h1>
    <p>${this.escapeHTML(description)}</p>
    <a href="discord:///">${this.escapeHTML(button)}</a>
  </div>
  ${trustedBodyScript}
</body>
</html>`;
  }

  private escapeHTML(text: string): string {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }
}
