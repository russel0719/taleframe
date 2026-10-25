import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // studio/ 는 Next·React 가 아니라 Hono 서버 렌더링(hono/jsx)과 순수 브라우저 스크립트다 — Next·React 전용 규칙은 맞지 않는다
  {
    files: ["studio/**"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-head-element": "off",
      "@next/next/no-css-tags": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-location-assign-relative-destination": "off",
      "react/jsx-key": "off",
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "work/**", "public/media/**", "public/vendor/**"]),
]);

export default eslintConfig;
