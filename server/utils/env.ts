export function getCntFromEnv() {
  if (!global.customEnv.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return global.customEnv.DATABASE_URL;
}
