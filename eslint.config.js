import antfu from "@antfu/eslint-config";

export default antfu(
  {
    typescript: true,
    stylistic: {
      indent: 2,
      semi: true,
      quotes: "double",
    },
    ignores: [
      ".kiro/**",
      ".github/instructions/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      "ts/no-redeclare": "off",
      "eslint-comments/no-unlimited-disable": "off",
      "style/brace-style": ["error", "1tbs"],
      "node/prefer-global/process": "off",
      "no-console": "warn",
      "ts/method-signature-style": "off",
      "style/function-paren-newline": ["error", "consistent"],
      "prefer-template": "off",
      "test/prefer-lowercase-title": "off",
    },
  },
  {
    files: ["**/*.md"],
    rules: {
      "style/no-trailing-spaces": "off",
    },
  },
);
