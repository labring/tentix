import * as jsonwebtoken from "jsonwebtoken";
import {
  sealosJWT,
  thirdPartyJWT,
  type SealosJWT,
  type ThirdPartyJWT,
} from "./types.ts";
import { areaRegionUuidMap } from "./const.ts";
/**
 * Parse and verify JWT token
 * @param token JWT token string
 * @param secret JWT secret key
 * @returns Parsed JWT payload
 */
export function parseJWT<T = any>(token: string, secret: string): T {
  try {
    const decoded = jsonwebtoken.verify(token, secret) as T;
    return decoded;
  } catch (error) {
    throw new Error(
      `JWT verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Parse Sealos JWT token specifically
 * @param token Sealos JWT token string
 * @returns Parsed and validated Sealos JWT payload
 */
export function parseSealosJWT(token: string, secret: string): SealosJWT {
  try {
    const decoded = parseJWT(token, secret);
    const validated = sealosJWT.parse(decoded);
    return validated;
  } catch (error) {
    throw new Error(
      `Sealos JWT parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Verify JWT token without parsing (just check if valid)
 * @param token JWT token string
 * @param secret JWT secret key
 * @returns boolean indicating if token is valid
 */
export function verifyJWT(token: string, secret?: string): boolean {
  try {
    if (!secret) {
      return false;
    }

    jsonwebtoken.verify(token, secret);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decode JWT token without verification (for debugging)
 * @param token JWT token string
 * @returns Decoded JWT payload (unverified)
 */
export function decodeJWT<T = any>(token: string): T | null {
  try {
    const decoded = jsonwebtoken.decode(token) as T;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if JWT token is expired
 * @param token JWT token string
 * @returns boolean indicating if token is expired
 */
export function isJWTExpired(token: string): boolean {
  try {
    const decoded = decodeJWT<{ exp?: number }>(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch {
    return true;
  }
}

/**
 * Create reverse mapping from regionUid to area code for efficient lookup
 */
const regionUuidToAreaMap = Object.fromEntries(
  Object.entries(areaRegionUuidMap).map(([area, uid]) => [uid, area]),
) as Record<string, keyof typeof areaRegionUuidMap>;

/**
 * Extract area code from sealos token
 *
 * @param token - JWT token from sealos
 * @returns Area code corresponding to the regionUid, defaults to 'hzh' if not found
 *
 * @example
 * ```typescript
 * const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
 * const areaCode = extractAreaFromSealosToken(token);
 * console.log(areaCode); // "hzh" or other area code
 * ```
 */
export const extractAreaFromSealosToken = (
  token: string,
): keyof typeof areaRegionUuidMap | null => {
  try {
    const decoded = decodeJWT<SealosJWT>(token);
    if (!decoded) {
      return null;
    }
    const areaCode = regionUuidToAreaMap[decoded.regionUid];
    return areaCode || "hzh";
  } catch (error) {
    return null;
  }
};

/**
 * Parse and verify third party JWT token specifically
 * @param token Third party JWT token string
 * @param secret JWT secret key (optional, uses default if not provided)
 * @returns Parsed and validated third party JWT payload
 */
export function parseThirdPartyJWT(
  token: string,
  secret: string,
): ThirdPartyJWT {
  try {
    const decoded = parseJWT(token, secret);
    const validated = thirdPartyJWT.parse(decoded);
    return validated;
  } catch (error) {
    throw new Error(
      `Third party JWT parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Detect if a token is a JWT format (has three parts separated by dots)
 * @param token Token string to check
 * @returns boolean indicating if token is JWT format
 */
export function isJWTFormat(token: string): boolean {
  try {
    const parts = token.split(".");
    return parts.length === 3 && parts.every((part) => part.length > 0);
  } catch {
    return false;
  }
}
