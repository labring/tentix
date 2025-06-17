import * as jsonwebtoken from "jsonwebtoken";
import { sealosJWT, type SealosJWT } from "./types.ts";
import { areaRegionUuidMap } from "./const.ts";
/**
 * Parse and verify JWT token
 * @param token JWT token string
 * @param secret JWT secret key
 * @returns Parsed JWT payload
 */
export function parseJWT<T = any>(token: string, secret?: string): T {
  try {
    const jwtSecret = secret || global.customEnv.SEALOS_APP_TOKEN;
    if (!jwtSecret) {
      throw new Error("JWT secret not configured");
    }

    const decoded = jsonwebtoken.verify(token, jwtSecret) as T;
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
export function parseSealosJWT(token: string): SealosJWT {
  try {
    const decoded = parseJWT(token);
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
    const jwtSecret = secret || global.customEnv.SEALOS_APP_TOKEN;
    if (!jwtSecret) {
      return false;
    }

    jsonwebtoken.verify(token, jwtSecret);
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
