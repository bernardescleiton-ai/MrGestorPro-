import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        globalThis: "readonly",
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["src/**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    plugins: { quality },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      complexity: ["warn", 12],
      "max-depth": ["warn", 4],
      "max-statements": ["warn", 20],
      "max-params": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ],
      "max-nested-callbacks": ["warn", 3],
      "quality/max-lines": ["error", { max: 350 }],
      // Baseline: 39 direct console calls found before the gate was installed.
      "quality/no-direct-console": [
        "warn",
        { logger: "a logging adapter" },
      ],
      "quality/no-direct-data-access": [
        "error",
        {
          modules: ["./lib/firebase", "../lib/firebase", "@/lib/firebase", "@/src/lib/firebase"],
          bindings: ["db"],
          layers: ["/src/components/"],
          extensions: [".tsx"],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/{__tests__,__mocks__,fixtures,mocks}/**/*.{ts,tsx}"],
    plugins: { quality },
    rules: {
      "quality/max-lines": ["warn", { includeTests: true }],
      "quality/no-direct-console": "off",
      "quality/no-direct-data-access": "off",
    },
  },
  {
    files: ["src/lib/logger.ts"],
    rules: {
      "quality/no-direct-console": "off",
    },
  },
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "**/*.tsbuildinfo",
    "package-lock.json",
    "bun.lock",
    "src/generated/**",
    "app/**",
  ]),
]);
