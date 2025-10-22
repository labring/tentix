#!/usr/bin/env bun
/**
 * Third-party login test token generator
 *
 * Usage:
 * bun --env-file=../.env.local ./script/genThirdPartyLoginTestToken.ts
 */

/* eslint-disable turbo/no-undeclared-env-vars, no-console */

import * as jsonwebtoken from "jsonwebtoken";

// Get JWT secret from environment
const getJWTSecret = (): string => {
  if (process.env.THIRD_PARTY_TOKEN) {
    console.log("THIRD_PARTY_TOKEN", process.env.THIRD_PARTY_TOKEN);
    return process.env.THIRD_PARTY_TOKEN;
  }
  throw new Error("THIRD_PARTY_TOKEN_JWT_SECRET is not set");
};

// Generate test token
function generateTestToken() {
  const secret = getJWTSecret();
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    sub: "test_user_001",
    name: "Test User",
    nickname: "Tester",
    realName: "Zhang Test",
    phoneNum: "+8613812345678",
    avatar: "https://example.com/avatar.jpg",
    email: "test@example.com",
    level: 5,
    meta: {
      department: "Tech Dept",
      position: "Test Engineer",
      location: {
        city: "Beijing",
        district: "Haidian",
      },
      skills: ["JavaScript", "TypeScript", "React"],
      preferences: {
        theme: "dark",
        language: "zh-CN",
      },
      tags: ["VIP User", "Tech Expert"],
    },
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days
    iss: "test-system",
    aud: "tentix",
  };

  return jsonwebtoken.sign(payload, secret);
}

const token = generateTestToken();
console.log("Third-party login test token:");
console.log(token);
console.log("\nUsage:");
console.log("POST /api/auth/third-party?token=<token_above>");

// 确保URL正确编码
const encodedToken = encodeURIComponent(token);
console.log("\nFrontend redirect URL (with proper encoding):");
console.log(`http://localhost:5173?token=${encodedToken}`);
console.log(
  "\nNote: Modern browsers and frameworks handle URL encoding automatically,",
);
console.log(
  "but explicit encoding ensures compatibility across all scenarios.",
);
