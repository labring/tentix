import { AppConfig } from "./types.ts";

export function getCntFromEnv() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return process.env.DATABASE_URL;
}



export async function readConfig(): Promise<AppConfig> {
  if (global.config) {
    return global.config;
  }
  const configName = process.env.NODE_ENV === "production" ? "config.prod.json" : "config.dev.json";
  console.log('Reading config from: ', configName);
  global.config = await Bun.file(configName).json();
  return global.config!;
}

