import js from "@eslint/js";
import globals from "globals";

export default [
  {ignores: ["public/**", ".vercel/**"]},
  js.configs.recommended,
  {files: ["src/**/*.js"], languageOptions: {globals: globals.browser}},
  {files: ["backend.js", "api/**/*.js", "scripts/**/*.js", "tests/**/*.js", "eslint.config.js"], languageOptions: {globals: globals.node}},
  {rules: {eqeqeq: "error", "no-var": "error", "prefer-const": "error", "no-unused-vars": "error"}}
];
