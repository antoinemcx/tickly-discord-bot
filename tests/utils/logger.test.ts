import {
  displayCustom,
  displayError,
  displayInfo,
  displayLoaded,
  displaySuccess,
} from "@src/utils/logger";

const validMessages: string[] = [
  "a",
  ".",
  " ",
  "A little looooooooooooooooooooong messageeee test !!!!!!!!!",
];

describe("logger utils", () => {
  describe("displayCustom", () => {
    it("should throw SyntaxError if content is empty", () => {
      expect(() => displayCustom("")).toThrow(SyntaxError);
    });

    it("should not throw if content is valid", () => {
      validMessages.forEach((message) => {
        expect(() => displayCustom(message)).not.toThrow();
      });
    });
  });

  describe("displayError", () => {
    it("should throw SyntaxError if content is empty", () => {
      expect(() => displayError("")).toThrow(SyntaxError);
    });

    it("should not throw if content is valid", () => {
      validMessages.forEach((message) => {
        expect(() => displayError(message)).not.toThrow();
      });
    });
  });

  describe("displayInfo", () => {
    it("should throw SyntaxError if content is empty", () => {
      expect(() => displayInfo("")).toThrow(SyntaxError);
    });

    it("should not throw if content is valid", () => {
      validMessages.forEach((message) => {
        expect(() => displayInfo(message)).not.toThrow();
      });
    });
  });
});

describe("displaySuccess", () => {
  it("should throw SyntaxError if content is empty", () => {
    expect(() => displaySuccess("")).toThrow(SyntaxError);
  });

  it("should not throw if content is valid", () => {
    validMessages.forEach((message) => {
      expect(() => displaySuccess(message)).not.toThrow();
    });
  });
});

describe("displayLoaded", () => {
  it("should throw SyntaxError if content is empty", () => {
    expect(() => displayLoaded("")).toThrow(SyntaxError);
  });

  it("should not throw if content is valid", () => {
    validMessages.forEach((message) => {
      expect(() => displayLoaded(message)).not.toThrow();
    });
  });
});
