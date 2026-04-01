/** Error thrown when an error occurs during the OAuth callback verification. */
export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthError";
  }
}
