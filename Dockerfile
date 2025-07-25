ARG BUN_VERSION=1.2.16
FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

ENV NODE_ENV="production"

FROM base AS build

COPY package.json bun.lock turbo.json tsconfig.json ./
COPY frontend ./frontend/
COPY server ./server/
COPY packages/ ./packages/
RUN bun install --frozen-lockfile
RUN bun run build

FROM base AS production

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=build --chown=appuser:appuser /app/server/dist /app/dist
COPY --from=build --chown=appuser:appuser /app/package.json /app/

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["bun", "/app/dist/server.js"]