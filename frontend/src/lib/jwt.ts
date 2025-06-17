import { areaRegionUuidMap } from "tentix-server/constants";
import { type SealosJWT } from "tentix-server/types";

/**
 * Base64 URL decode helper function
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }
  
  return atob(base64);
}

/**
 * Decode JWT token without verification (browser-safe implementation)
 * @param token JWT token string
 * @returns Decoded JWT payload (unverified)
 */
export function decodeJWT<T = any>(token: string): T | null {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }

    // Decode the payload
    const decodedPayload = base64UrlDecode(payload);
    return JSON.parse(decodedPayload) as T;
  } catch (error) {
    return null;
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
 */
export const extractAreaFromSealosToken = (
  token: string,
): keyof typeof areaRegionUuidMap | null => {
  try {
    const decoded = decodeJWT<SealosJWT>(token);
    if (!decoded || !decoded.regionUid) {
      return "hzh"; // 默认返回 hzh
    }

    const areaCode = regionUuidToAreaMap[decoded.regionUid];
    return areaCode || "hzh";
  } catch (error) {
    return null;
  }
}; 