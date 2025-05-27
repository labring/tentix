import { config as baseConfig } from "./packages/eslint-config/base.js";

export default [
  ...baseConfig,
  {
    ignores: [
      "apps/**", 
      "packages/**",
      "frontend/**",
      "server/**",
    ],
  },
];
