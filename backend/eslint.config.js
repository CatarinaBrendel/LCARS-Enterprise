// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  // ESLint's recommended JS rules
  js.configs.recommended,

  // Ignore built/third-party stuff
  {
    ignores: ["dist/**", "build/**", "coverage/**", "**/*.min.js", "node_modules/**"],
  },

  // JS/React setup
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "unused-imports": unusedImports,
    },
    rules: {
      "react/jsx-uses-react": "off",       // not needed in React 17+
      "react/react-in-jsx-scope": "off",   // not needed in React 17+
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "unused-imports/no-unused-imports": "error",
    },
  },
];
