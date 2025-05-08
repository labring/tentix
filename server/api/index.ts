import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { authRouter } from "./auth/index.ts";
import { chatRouter } from "./chat/index.ts";
import { factory, handleError } from "./middleware.ts";
import { fileRouter } from "./file/index.ts";
import { ticketRouter } from "./ticket/index.ts";
import { userRouter } from "./user/index.ts";
import { websocket, wsRouter } from "./ws/index.ts";
import { adminRouter } from "./admin/index.ts";
import { playgroundRouter } from "./playground/index.ts";






const app = factory.createApp();

app.onError(handleError);
app.use("*", logger());
app.get(
  "/api/openapi.json",
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
      components: {
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            name: "identity",
            in: "cookie",
            description: "Cookie for authentication. Contains userId===role.",
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
    // hiddenClients: true,
  }),
);

const routes = app
  .basePath("/api")
  .route("/user", userRouter)
  .route("/chat", chatRouter)
  .route("/ticket", ticketRouter)
  .route("/auth", authRouter)
  .route("/ws", wsRouter)
  .route("/file", fileRouter)
  .route("/admin", adminRouter)
  .route("/playground", playgroundRouter); // RPC routes

app.use(
  "*",
  serveStatic({ root: "/Users/yiming/Desktop/tentix-v2/server/dist" }),
);
app.use(
  "*",
  serveStatic({
    root: "/Users/yiming/Desktop/tentix-v2/server/dist",
    path: "./index.html",
  }),
);

export type AppType = typeof routes;

export default {
  fetch: app.fetch,
  websocket,
};
