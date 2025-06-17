export const areaEnumArray = [
  "bja",
  "hzh",
  "gzg",
  "io",
  "usw",
  "test",
] as const;

/**
 * Area region UUID mapping
 */
export const areaRegionUuidMap = {
  bja: "0dba3d90-2bae-4fb6-83f7-89620656574f",
  hzh: "f8fe0f97-4550-472f-aa9a-72ed34e60952",
  gzg: "6a216614-e658-4482-a244-e4311390715f",
  io: "2e07bb48-e88c-4bb8-b2c8-03198b8fe66d",
  usw: "00000000-0000-0000-0000-000000000000",
  test: "00000000-0000-0000-0000-000000000000",
} as const;

export const moduleEnumArray = [
  "all",
  "applaunchpad",
  "costcenter",
  "appmarket",
  "db",
  "account_center",
  "aiproxy",
  "devbox",
  "task",
  "cloudserver",
  "objectstorage",
  "laf",
  "kubepanel",
  "terminal",
  "workorder",
  "other",
] as const;

export const ticketCategoryEnumArray = [
  "uncategorized",
  "bug",
  "feature",
  "question",
  "other",
] as const;

/**
 * Ticket priority enum array
 *
 * @example
 * "normal" // normal consultation
 * "low" // operation experience problem
 * "medium" // business/system exception affects use
 * "high" // business completely unavailable
 * "urgent" // urgent
 */
export const ticketPriorityEnumArray = [
  "normal",
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const ticketStatusEnumArray = [
  "pending",
  "in_progress",
  "resolved",
  "scheduled",
] as const;

/**
 * Ticket history type enum array
 *
 * @description
 * | **history_type** | **meta(integer)**            |
 * |:----------------:|:--------------------------:|
 * | create           | customer user Id           |
 * | update           | who modify the information |
 * | assign           | The assignee Id            |
 * | upgrade          | who modify this            |
 * | transfer         | transfer to somebody's Id  |
 * | makeRequest      | who do this                |
 * | resolve          | who resolve this           |
 * | close            | who close this             |
 *
 */
export const ticketHistoryTypeEnumArray = [
  "create",
  "first_reply",
  "join",
  "category",
  "update",
  "upgrade",
  "transfer",
  "makeRequest",
  "resolve",
  "close",
  "other",
] as const;

export const userRoleEnumArray = [
  "system",
  "customer",
  "agent",
  "technician",
  "admin",
  "ai",
] as const;

/**
 * WebSocket token expiry time
 *
 * @example
 * 12 * 60 * 60 * 1000 // 12 hour in milliseconds
 */
export const WS_TOKEN_EXPIRY_TIME = 12 * 60 * 60 * 1000;

/**
 * Cookie expiry time
 *
 * @example
 * 1000 * 60 * 60 * 24 * 30 // 30 days in milliseconds
 */
export const COOKIE_EXPIRY_TIME = 1000 * 60 * 60 * 24 * 30;

export function getIndex<T extends readonly string[]>(arr: T, key: T[number]) {
  return arr.findIndex((item) => item === key);
}

export function getEnumKey<T extends readonly string[]>(arr: T, index: number) {
  return arr[index];
}
