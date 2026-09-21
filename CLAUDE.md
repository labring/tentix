# CLAUDE.md

## Scope

This file applies to this repository. If it conflicts with `~/.claude/CLAUDE.md`, this file wins; if a subdirectory has a closer CLAUDE.md, the closer one wins.

## Commands

- Bun only. `.npmrc` pins `package-manager=bun` and the root `package.json` declares `packageManager: bun@1.2.16`; never use npm / yarn / pnpm / pnpx.
- Root: `bun install`, `bun run dev`, `bun run lint`, `bun run typecheck`, `bun run build` (all orchestrated by turbo), `bun run format`.
- The root has **no** `test` script, so `bun run test` fails outright. CI hides this with `bun run test || echo "Tests not configured"` — never read a green CI as proof that tests ran.
- Server tests use bun:test and live in `server/test/*.spec.ts`. Single file: `cd server && bun test test/md.spec.ts` (verified working).
- Frontend `bun run test` is `vitest run`, but `frontend/src` currently contains 0 test files; never claim "frontend tests passed".
- Per workspace: `cd frontend && bun run {lint,typecheck,test,build}`; `cd server && bun run {lint,typecheck,build,dev}`; `cd packages/ui && bun run {lint,typecheck}`.
- Database commands must run from `server/` and already carry `--env-file=../.env.local`: `bun run generate|migrate|studio|seed`.
- `server/script/` actually contains only `getCryptoKey.ts`, `resetDB.ts`, `seed.ts`, `genThirdPartyLoginTestToken.ts`; `initDB.ts` and `migrateStaffList.ts` do not exist.

## Architecture

- `server/api/`: Hono domain routers (auth / user / ticket / chat / file / admin / feishu / feedback / kb / analytics / playground).
- `server/api/index.ts`: routers are chained with `.route()` onto `basePath("/api")` and the result is exported as `AppType`; a new router must join that chain or the frontend gets no types. `playground` is registered only outside production.
- `server/api/middleware.ts`: `factory`, `authMiddleware`, role middleware, `handleError`, `MyEnv` / `AuthEnv`.
- `server/db/`: `schema.ts` + `relations.ts` are the source; `codegen/` holds drizzle-kit generated migration SQL (the `out` in `drizzle.config.ts`).
- `frontend/src/`: `routes/` (TanStack Router file routes, split into `user/` and `staff/`), `lib/query.ts` (queryOptions), `lib/api-client.ts` (RPC + ky), `store/` (Zustand).
- `packages/`: `ui` (package name tentix-ui, entry `uisrc/index.tsx`), `i18n` (translation tables in `index.ts`), `eslint-config`, `typescript-config`.

## Code Conventions

- `verbatimModuleSyntax: true`: type imports must be written as `import type`.
- `noUncheckedIndexedAccess: true`: indexed access is `T | undefined`, so guard it or use an explicit `!` (existing style: `err.errors[0]!`).
- Server imports keep the `.ts` extension and use the `@/` and `@db/` aliases (`allowImportingTsExtensions`); do not strip the extension.
- Frontend aliases are declared in `frontend/vite.config.js`: `@frontend @comp @store @hook @lib @modal @utils @server @db @api uisrc tentix-ui`; do not rewrite them as relative paths.
- Server errors are always thrown as `HTTPException` / `ValidationError` / ZodError and shaped by `handleError` into `{code,timeUTC,message}`; never hand-write error JSON inside a route.
- Route style: `factory` + `authMiddleware` + `describeRoute` + `validator`/`resolver` from `hono-openapi/zod` + `createSelectSchema` from drizzle-zod.
- Frontend server-data queries are defined once as `queryOptions` in `lib/query.ts` and reused; do not scatter query logic across components.
- All HTTP goes through `apiClient` / `myFetch` (ky), which handles `Authorization`, `Accept-Language` and the 401 redirect; never call `fetch` directly.
- ESLint: `prefer-const`/`no-var`/`prefer-template`/`object-shorthand`/`no-duplicate-imports` are errors, `no-explicit-any` is a warning; unused variables are only allowed with a leading `_`; the server config adds `no-console` (warn) and the drizzle rules.
- Never hand-edit generated artifacts: `frontend/src/routeTree.gen.ts`, `server/db/codegen/**`, `server/output/**`, any `types/**`, `dist/**`.
- User-facing copy (buttons, labels, prompts, errors, placeholders) must go through i18n whenever it can; code comments, dev docs and debug logs are exempt.
- Commit messages are English conventional commits with a lowercase prefix: `feat:` / `fix:` / `refactor:` / `style:`, optionally scoped like `feat(i18n):`.

## Working Principles

- Read before writing: read a file before editing it; never reference an unread file in analysis or a plan.
- Grade every claim about current state: mark what you read as `[已读确认]` (verified by reading) and what you inferred as `[假设-需验证]` (assumption, needs checking), plus how the conclusion changes if the assumption is wrong.
- Minimal change: touch only what the request requires, plus the null / error / concurrency / permission handling directly tied to that change.
- Classify each edit as (a) request-required / (b) safety-required / (c) other; never perform (c) — move it to the extra-findings list.
- Do not bundle extra findings: bugs, risks and cleanup ideas you notice while reading go in a separate list for the user to decide on.
- Ask about material uncertainties first, at most 3 questions; for low-risk points proceed on a reasonable assumption and label it.
- Any plan touching frontend UI must state its mobile impact (narrow-viewport layout, touch interaction that does not depend on hover, virtual keyboard and safe area); if there is none, say so explicitly.

## Safety

- No incidental edits: renaming, reformatting / reindenting / changing quotes, reordering imports, deleting code / comments / logs that "look unused", refactoring, extracting helpers, changing unrelated type signatures. Words like "while I'm here", "also", "additionally", "more idiomatic" or "let me optimize" in your own plan are scope-creep warnings.
- If the same command fails twice, stop and report the evidence; no workarounds: deleting tests, rewriting assertions, skipping, loosening types, `--force`.
- A failing test means the implementation is wrong, not the test; never edit tests to go green unless the user asked for test maintenance.
- Confirm before destructive operations: deleting files, `git reset`, force push, running migrations, upgrading dependencies, pushing images.
- Stage only the files your change actually touched; never `git add -A` or `git add .`, since a working tree may hold unrelated local files.
- Never revert changes the user did not ask you to revert; leave unrelated dirty files alone.
- Never commit secrets: `.env.local`, credentials, registry tokens and API keys stay out of the repo.
- Compile / typecheck failures: mechanical slips (missing import, unbalanced brackets, obvious typo) may be fixed but must be labeled "自行修复" (fixed on my own) in the report; logical failures must be reported verbatim for the user to decide — do not fix them yourself.

## Verification

- Server changes: run the narrowest matching `cd server && bun test test/<name>.spec.ts` when a test exists, then `cd server && bun run typecheck`; add `cd server && bun run lint` when touching api / db / shared utils.
- Frontend changes: `cd frontend && bun run typecheck`; add `cd frontend && bun run lint` for shared components or broad changes (threshold `--max-warnings 150`, exceeding it fails). There are no frontend tests — do not pretend you ran any.
- `packages/*` or cross-workspace changes: root `bun run typecheck` + `bun run lint` (`packages/ui` lints with `--max-warnings 100`).
- When build output, routing or Vite/Turbo config is affected, verify with root `bun run build` (turbo runs `typecheck` then `build`), or by starting `bun run dev` and stopping it once checked.
- Reports must name the exact command run and its result. When verification is impossible, state the concrete blocker plus the residual risk; never replace verification with "should be fine".

## Communication

- Reply in Chinese; code, comments and commit messages in English (except when preserving existing user-facing copy).
- Report in this order: files changed → items skipped and why → verification commands and results → self-review doubts → regression points needing manual confirmation → findings noticed but left untouched.
- Label questions and risks by confidence: `[核心]` (core — users will actually see breakage if unfixed) / `[边缘]` (edge — plausible but uncertain to trigger) / `[凑数]` (padding — would not raise it unprompted).
- Describe business impact in plain words about what the user will see, not a pile of function and type names.
