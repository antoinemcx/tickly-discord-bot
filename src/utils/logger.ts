import moment from "moment";

const timestamp: string = `[\x1B[90m${moment().format("HH:mm:ss")}\x1B[0m]`;

/**
 * Generates a random error code to be used for logging with
 * 2 random characters and 6 random digits.
 * @returns the generated error code
 */
export function generateErrorCode(): string {
  const randomChars = 2;
  const randomDigits = 6;
  return Math.random().toString(36).substring(2, 2 + randomChars)
    + Math.floor(
      10 * 10 ** (randomDigits - 1) + Math.random() * 9 * 10 ** (randomDigits - 1),
    ).toString();
}

export function displayCustom(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.log(timestamp + " " + content);
}

export function displayError(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.error(`${timestamp} \x1B[31mError\x1B[0m : ${content}`);
}

export function displayDetailedError(content: string, error: unknown, errorCode?: string) {
  if (!content) {
    throw new SyntaxError("There is no content to display.");
  }
  console.error(`${timestamp} \x1B[31mError\x1B[0m : ${content}`
    + (errorCode ? ` (code: ${errorCode})` : "")
    + " (" + (error instanceof Error ? error.message : String(error)) + ")"
    + (error instanceof Error ? `\n${error.stack}` : ""));
}

export function displayInfo(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.log(`${timestamp} \x1B[36mInfo\x1B[0m ${content}`);
}

export function displayWarning(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.warn(`${timestamp} \x1B[33mWarning\x1B[0m ${content}`);
}

export function displaySuccess(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.log(`${timestamp} \x1B[32mSuccess\x1B[0m ${content}`);
}

export function displayLoaded(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.log(`${timestamp} ㄴ ${content} loaded`);
}
