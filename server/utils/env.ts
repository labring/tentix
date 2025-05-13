import { AppConfig } from "./types.ts";

export function getCntFromEnv() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return process.env.DATABASE_URL;
}



export async function readConfig() {
  if (globalThis.config) {
    return globalThis.config;
  }
  if (process.env.NODE_ENV === "production") {
    globalThis.config = await Bun.file("config.prod.json").json();
  } else {
    globalThis.config = await Bun.file("config.dev.json").json();
  }
  return globalThis.config!;
}

