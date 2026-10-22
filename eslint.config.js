import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**", "services/**", "**/generated/**", "**/*.tsbuildinfo"] },
  js.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: { globals: { URL: "readonly", process: "readonly", console: "readonly" } },
  },
  ...tseslint.configs.recommended,
);
