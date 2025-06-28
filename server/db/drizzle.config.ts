import { defineConfig } from "drizzle-kit";
// import { getCntFromEnv } from "../utils/env.ts";

export default defineConfig({
  dialect: "postgresql",
  out: "./db/codegen",
  schema: ["./db/schema.ts", "./db/relations.ts"],
  dbCredentials: {
    // url: getCntFromEnv(),
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["tentix"],
  introspect: {
    casing: "camel",
  },
});
