import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Shared Presslyn ESLint flat config (ESLint 9). Consumed by every app and
 * package via a local `eslint.config.mjs` that spreads this array. Type-aware
 * linting is intentionally off (fast, no project service); `no-undef` is
 * disabled because TypeScript already resolves identifiers.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/next-env.d.ts",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript resolves identifiers; the core rule produces false
      // positives for globals (process, fetch, etc.) without a globals pkg.
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Test files legitimately use `any`/`never` to fake the complex generic
    // types of the DB layer (Drizzle) and storage adapters in mocks.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
