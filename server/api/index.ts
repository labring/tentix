import "./precede.ts";
import "./initApp.ts";

import { Scalar } from "@scalar/hono-api-reference";
import { openAPISpecs } from "hono-openapi";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { authRouter } from "./auth/index.ts";
import { factory, handleError } from "./middleware.ts";
import { fileRouter } from "./file/index.ts";
import { ticketRouter } from "./ticket/index.ts";
import { userRouter } from "./user/index.ts";
import { websocket, chatRouter } from "./chat/index.ts";
import { adminRouter } from "./admin/index.ts";
import { playgroundRouter } from "./playground/index.ts";
import { feishuRouter } from "./feishu/index.ts";
import { feedbackRouter } from "./feedback/index.ts";
import { startAllJobs } from "@/utils/jobs/kb-jobs/index.ts";
import "@/utils/events/handoff/index.ts";
import { kbRouter } from "./kb/index.ts";
import { logInfo } from "@/utils/log.ts";

const app = factory.createApp();

// error handler
app.onError(handleError);

// Configure logging based on environment
if (global.customEnv.NODE_ENV !== "production") {
  // Development: log all requests
  app.use("*", logger());
} else {
  // Production: only log errors and slow requests
  app.use(
    "*",
    logger((message) => {
      // Extract status code and response time from log message
      // Format: "<-- GET /" and "--> GET / 200 2ms"
      const responsePattern = /--> .+ (\d{3}) (\d+)ms/;
      const match = message.match(responsePattern);

      if (match && match[1] && match[2]) {
        const status = parseInt(match[1]);
        const responseTime = parseInt(match[2]);

        // Log errors (4xx, 5xx) or slow requests (>1000ms)
        if (status >= 400 || responseTime > 1000) {
          logInfo(message);
        }
      }
      // Don't log request start messages (<-- GET /) in production
    }),
  );
}

app.use(
  "/api/openapi.json",
  openAPISpecs(app, {
    documentation: {
      info: {
        title: "Tentix API",
        version: "1.0.0",
        description: "API for Tentix",
      },
      tags: [
        {
          name: "User",
          description: "User related endpoints",
        },
        {
          name: "Ticket",
          description: "Ticket related endpoints",
        },
        {
          name: "Auth",
        },
        {
          name: "Playground",
          description: "Test endpoint. Not for production use.",
        },
        {
          name: "Feishu",
          description: "Feishu related endpoints",
        },
        {
          name: "Feedback",
          description: "Feedback related endpoints",
        },
      ],
      servers: [
        {
          url: "/",
          description: "Current server",
        },
        {
          url: "http://localhost:3000",
          description: "Local server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description:
              "Bearer token for authentication. Contains userId##role##expireTime(timestamp, seconds). It be encrypted by AES-CBC.",
          },
        },
      },
    },
  }),
);
app.get(
  "/api/reference",
  Scalar({
    url: "/api/openapi.json",
    isEditable: false,
    hideClientButton: true,
  }),
);
app.get("/health", (c) => c.json({ status: "ok" }));

const routes = app // RPC routes
  .basePath("/api")
  .route("/user", userRouter)
  .route("/ticket", ticketRouter)
  .route("/auth", authRouter)
  .route("/chat", chatRouter)
  .route("/file", fileRouter)
  .route("/admin", adminRouter)
  .route("/feishu", feishuRouter)
  .route("/feedback", feedbackRouter)
  .route("/kb", kbRouter);
if (global.customEnv.NODE_ENV !== "production") {
  routes.route("/playground", playgroundRouter);
}

export type AppType = typeof routes;

app.use("*", serveStatic({ root: "./dist" }));
app.use(
  "*",
  serveStatic({
    root: "./dist",
    path: "./index.html",
  }),
);

// 启动所有jobs
startAllJobs();

export default {
  fetch: app.fetch,
  websocket,
};
