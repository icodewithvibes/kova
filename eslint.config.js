import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Currency safety: raw number arithmetic on money is forbidden outside domain/money.ts.
      // Money values are branded Cents created only via money.ts constructors.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: "parseFloat on money values loses precision. Use domain/money.ts parsers.",
        },
      ],
    },
  },
  {
    files: ["src/domain/money.ts", "src/**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": "off" },
  },
);
