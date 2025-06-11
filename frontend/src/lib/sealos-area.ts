/**
 * Sealos token payload interface
 */
interface SealosTokenPayload {
  workspaceUid: string;
  workspaceId: string;
  regionUid: string;
  userCrUid: string;
  userCrName: string;
  userId: string;
  userUid: string;
  iat: number;
  exp: number;
}

/**
 * Area region UUID mapping
 */
const areaRegionUuidMap = {
  bja: "0dba3d90-2bae-4fb6-83f7-89620656574f",
  hzh: "f8fe0f97-4550-472f-aa9a-72ed34e60952",
  gzg: "6a216614-e658-4482-a244-e4311390715f",
  io: "2e07bb48-e88c-4bb8-b2c8-03198b8fe66d",
  usw: "00000000-0000-0000-0000-000000000000",
  test: "00000000-0000-0000-0000-000000000000",
} as const;

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
export function extractAreaFromSealosToken(
  token: string,
): keyof typeof areaRegionUuidMap | null {
  try {
    // 解析 JWT token (不验证签名，只解码)
    const parts = token.split(".");
    if (parts.length !== 3) {
      return "hzh";
    }

    // 解码 payload (第二部分)
    const payload = parts[1];
    if (!payload) {
      return "hzh";
    }

    // Base64 URL 解码
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = atob(base64);
    const parsedPayload: SealosTokenPayload = JSON.parse(decodedPayload);

    // 使用预构建的映射表快速查找
    const areaCode = regionUuidToAreaMap[parsedPayload.regionUid];
    return areaCode || "hzh";
  } catch (error) {
    // 解析失败时返回默认值
    return null;
  }
}

/**
 * Extract regionUid from sealos token
 *
 * @param token - JWT token from sealos
 * @returns regionUid from token payload, or null if not found
 */
export function extractRegionUidFromSealosToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = atob(base64);
    const parsedPayload: SealosTokenPayload = JSON.parse(decodedPayload);

    return parsedPayload.regionUid || null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse full sealos token payload
 *
 * @param token - JWT token from sealos
 * @returns Parsed token payload or null if parsing fails
 */
export function parseSealosToken(token: string): SealosTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decodedPayload = atob(base64);
    return JSON.parse(decodedPayload);
  } catch (error) {
    return null;
  }
}
