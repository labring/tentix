import type { Context } from "hono";

export type Locale = "zh" | "en";

export function detectLocale(c: Context): Locale {
  const header = c.req.header("accept-language") || "";
  return header.toLowerCase().includes("zh") ? "zh" : "en";
}


