import nextPlugin from "@next/eslint-plugin-next";
import base from "./index.js";

/**
 * Next.js app ESLint config: the shared base plus the official Next plugin's
 * core-web-vitals rules (no-img-element, no-html-link-for-pages, etc.) scoped
 * to the app source. Used by apps/admin and apps/web.
 */
export default [
  ...base,
  {
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
