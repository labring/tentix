import { logInfo } from "./log.ts";
import { AppConfig } from "./types.ts";

export function getCntFromEnv() {
  if (!global.customEnv.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return global.customEnv.DATABASE_URL;
}



export async function readConfig(): Promise<AppConfig> {
  if (global.config) {
    return global.config;
  }
  const configName = global.customEnv.NODE_ENV === "production" ? "config.prod.json" : "config.dev.json";
  logInfo(`Reading config from: ${configName}`);
  global.config = await Bun.file(configName).json();
  return global.config!;
}

