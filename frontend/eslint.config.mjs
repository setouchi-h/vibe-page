import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [{ ignores: ["cloudflare-env.d.ts", ".open-next/**"] }, ...nextVitals, ...nextTypescript];

export default eslintConfig;
