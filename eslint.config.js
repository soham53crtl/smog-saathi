import js from "@eslint/js";
import globals from "globals";

export default [
  {ignores: ["public/**", ".vercel/**"]},
  js.configs.recommended,
  {files: ["src/**/*.js"], languageOptions: {globals: globals.browser}},
  {
    files: [
      "backend.js",
      "lib/**/*.js",
      "api/**/*.js",
      "scripts/**/*.js",
      "tests/**/*.js",
      "eslint.config.js"
    ],
    languageOptions: {globals: globals.node}
  },
  {
    rules: {
      eqeqeq: "error",
      curly: ["error", "all"],
      "no-var": "error",
      "prefer-const": "error",
      "no-unused-vars": "error",
      "no-shadow": "error",
      "no-else-return": "error",
      "no-param-reassign": "error",
      "no-throw-literal": "error",
      "no-implicit-coercion": "error"
    }
  }
];
