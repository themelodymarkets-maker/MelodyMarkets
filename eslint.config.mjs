import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "server.js"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Em-dashes are the loudest tell that copy was generated. Fail the build
      // if one appears in a string literal, template string, or JSX text.
      // (\u2014 is the em-dash; replace with a period, comma, or colon.)
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\u2014/]",
          message: "Em-dashes (\u2014) are banned. Use a period, comma, or colon.",
        },
        {
          selector: "TemplateElement[value.raw=/\\u2014/]",
          message: "Em-dashes (\u2014) are banned. Use a period, comma, or colon.",
        },
        {
          selector: "JSXText[value=/\\u2014/]",
          message: "Em-dashes (\u2014) are banned. Use a period, comma, or colon.",
        },
      ],
    },
  },
];

export default eslintConfig;
