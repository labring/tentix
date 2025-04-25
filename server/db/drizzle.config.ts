import { defineConfig } from "drizzle-kit";
import { getCntFromEnv } from "../utils.ts";


export default defineConfig({
  dialect: "postgresql",
  out: "./db/codegen",
  schema: ["./db/schema.ts", "./db/relations.ts"],
  dbCredentials: {
    url: getCntFromEnv(),
  },
  schemaFilter: ["tentix"],
  introspect: {
    casing: "camel",
  },
});
