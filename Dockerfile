ARG BUN_VERSION=1.2.12
FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

ENV NODE_ENV="production"

FROM base AS build

COPY package.json bun.lock ./
COPY frontend/ ./frontend/
COPY server/ ./server/
COPY packages/ ./packages/
COPY turbo.json tsconfig.json ./

RUN bun install --frozen-lockfile

WORKDIR /app/frontend
RUN bun run build:prod

WORKDIR /app/server
RUN bun run build:prod

FROM base

COPY --from=build /app/server/dist /app/dist
COPY --from=build /app/package.json /app/

EXPOSE 3000

CMD ["bun", "/app/dist/server.js"]