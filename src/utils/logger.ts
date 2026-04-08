import moment from "moment";

const timestamp: string = `[\x1B[90m${moment().format("HH:mm:ss")}\x1B[0m]`;

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

export function displayInfo(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.log(`${timestamp} \x1B[36mInfo\x1B[0m ${content}`);
}

export function displaySuccess(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.log(`${timestamp} \x1B[32mSuccess\x1B[0m ${content}`);
}

export function displayLoaded(content: string) {
  if (!content)
    throw new SyntaxError("There is no content to display.");
  console.log(`${timestamp} ㄴ [\x1B[32mloaded\x1B[0m] ${content}`);
}
