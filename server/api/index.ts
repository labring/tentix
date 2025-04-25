import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { handleError } from "./error.ts";

import { openAPISpecs } from "hono-openapi";

import { ticketRouter } from "./ticket/index.ts";
import { userRouter } from "./user/index.ts";
import { chatRouter } from "./chat/index.ts";

import { Scalar } from "@scalar/hono-api-reference";

export const runtime = "nodejs";

const app = new Hono().basePath("/api");

app.onError(handleError);
app.use("*", logger());

app.get("*", serveStatic({ root: "./frontend/dist" }));
app.get("*", serveStatic({ path: "./frontend/dist/index.html" }));

app.get(
	"/openapi.json",
	openAPISpecs(app, {
		documentation: {
			info: {
				title: "Tentix API",
				version: "1.0.0",
				description: "API for Tentix",
			},
			servers: [
				{
					url: "http://localhost:3000",
					description: "Local server",
				},
			],
		},
	}),
);

app.get(
  '/reference',
  Scalar({
    url: '/api/openapi.json'
  }),
)

const routes = app
	.route("/user", userRouter)
	.route("/chat", chatRouter)
	.route("/ticket", ticketRouter);

export type AppType = typeof routes;

export default app;
