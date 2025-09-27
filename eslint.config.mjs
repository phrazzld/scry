import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    ignores: [
      "lib/generated/**/*",
      ".next/**/*",
      "out/**/*",
      "node_modules/**/*",
      "dist/**/*",
      "build/**/*"
    ]
  },
  {
    // Default rules for all files
    rules: {
      // Allow console.error and console.warn for legitimate error reporting
      // Disallow console.log in production code
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  },
  {
    // Override for test files
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "no-console": "off"  // Allow all console in tests
    }
  },
  {
    // Override for scripts and config files
    files: ["scripts/**/*", "*.config.*", "*.setup.*"],
    rules: {
      "no-console": "off"  // Scripts can use console.log for output
    }
  }
];

export default eslintConfig;
