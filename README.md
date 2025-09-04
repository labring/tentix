# Tentix = Ten (10x Efficiency) Tix (Ticketing System)

[English](README.md) | [中文](README.zh-CN.md)

An AI-native customer service platform that delivers 10x accelerated resolution.

- 🚀 10x faster response time
- 🤖 10x less human intervention
- 😊 10x higher customer satisfaction

![Tentix UI](https://github.com/user-attachments/assets/798dbbd3-4b78-4412-bf69-fda27f12d128)

## 🖥 Try on Sealos

One-click deployment in the App Market. Configure one AI agent and one staff member to try it out.

[![Deploy on Sealos](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://bja.sealos.run/?openapp=system-template%3FtemplateName%3Dtentix)

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Requirements](#requirements)
- [Deployment](#deployment)
- [Developer Guide](#developer-guide)
- [Roadmap](#roadmap)
- [Contributing](#-contributing)
- [Support](#-support)

## Architecture

```mermaid
graph TD
    A[Ticket data sources] --> B[Knowledge base builder]
    C[General docs] --> B
    D[Starred conversations] --> B

    B --> E[Unified Vector KB<br/>PostgreSQL + pgvector]

    E --> F[LangGraph AI Agent]

    G[User messages] --> H[Query refinement]
    I[Ticket info] --> H

    H --> J[Knowledge retrieval]
    E --> J

    J --> F
    F --> K[Generate reply]

    subgraph "Knowledge priority"
        L[1. Starred conversations<br/>Weight: 1.0]
        M[2. Historical tickets<br/>Weight: 0.8]
        N[3. General knowledge<br/>Weight: 0.6]
    end
```

```mermaid
graph TD
    A[Start build] --> B{Select knowledge type}

    B -->|Starred| C[Extract starred tickets/messages]
    B -->|Historical| D[Filter solved, high-quality tickets]
    B -->|General| E[Load document files]

    C --> F[AI-enhanced processing<br/>Summaries and retrievers]
    D --> G[Ticket doc building<br/>Key dialog extraction]
    E --> H[Document chunking]

    F --> I[Embedding]
    G --> I
    H --> I

    I --> J[Store into unified KB]
    J --> K[Done]
```

## Features

- Customer service chat system
- AI workflow (LangGraph: Analyze → Generate query → Retrieve → Generate answer)
- Multi-channel notifications; Feishu supported; other IM/forms via modular integration
- Extensible architecture: Modular design for pluggable extensions
- Unified authentication design: Pluggable third-party integrations
- Vector backend: PostgreSQL + pgvector or external vector service (FastGPT)
- Agent model config: Model/temperature/TopP/max tokens, etc., configurable in admin

## Requirements

- Bun ≥ 1.2.16
- PostgreSQL (with pgvector extension)
- MinIO (or S3-compatible object storage)
- OpenAI/FastGPT credentials

## Deployment

### 1) Build Docker image

```bash
docker build -t tentix:latest .
```

### 2) Configure PostgreSQL and run migrations

> Note: Migration reads `.env.local` in the project root. Set `DATABASE_URL` first.

```bash
cd server
bun run migrate
```

### 3) Configure required environment variables

- Required:

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DB"

# Generate Base64 encryption key (run in server/):
#   cd server && bun run script/getCryptoKey.ts
ENCRYPTION_KEY="<Base64 key generated above>"

# Object storage for images and other media in conversations
MINIO_ACCESS_KEY="<minio-access-key>"
MINIO_SECRET_KEY="<minio-secret-key>"
MINIO_BUCKET="<bucket-name>"
MINIO_ENDPOINT="<http(s)://host:port>"  # e.g., http://minio:9000
```

- AI-related (optional, when enabling AI replies):

```bash
OPENAI_BASE_URL="<https://api.openai.com/v1>"
OPENAI_API_KEY="<openai-api-key>"
SUMMARY_MODEL="<model for summarization>"
EMBEDDING_MODEL="<model for embeddings>"
CHAT_MODEL="<model for chat>"
FAST_MODEL="<model for fast responses>"
MAX_AI_RESPONSES_PER_TICKET=3  # default 3
```

- Optional (Feishu group and staff push):

```bash
FEISHU_APP_ID="<feishu-app-id>"
FEISHU_APP_SECRET="<feishu-app-secret>"
FEISHU_CHAT_ID="<feishu-chat-id>"
APP_URL="<public app URL>"
```

### 5) Run the container

```bash
docker run -d \
  --name tentix \
  -p 3000:3000 \
  --env-file ./.env.local \
  tentix:latest
```

- Health check: `/health`
- Default port: `3000`

## Developer Guide

> Developer help: See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) · [server/README.md](server/README.md) · [frontend/README.md](frontend/README.md)

Follow these steps to quickly start the local development environment.

### Clone and Install

```bash
git clone https://github.com/labring/tentix.git
cd tentix
bun install
```

### Configure Database and Migrate

> Note: Migration reads `.env.local` in the project root; set `DATABASE_URL` first.
>
> You can provision a PostgreSQL database on the [Sealos Console](https://usw.sealos.io/). Sealos provides easy database setup and a built-in management UI.

```bash
# Create/edit .env.local in project root with at least:
echo 'DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DB"' >> .env.local

# Enter server/ and run migration
cd server
bun run migrate
```

Migrations completed.

### Configure Environment Variables

```bash
cp .env.template .env.local
# Complete/override variables in .env.local as needed (e.g., ENCRYPTION_KEY, MINIO_*, OPENAI_*)
```

> Tip: To generate `ENCRYPTION_KEY`, run `bun run script/getCryptoKey.ts` under `server/` and put the result into `.env.local`.

### Start Development

```bash
cd ..  # back to project root if currently under server/
bun run dev
```

### Common Commands

```bash
bun run lint
bun run typecheck
bun run format
bun run build
# Dry run build for testing and checking build errors
bun run build --dry
# Force build
bun run build --force
```

## Roadmap

Planned features in priority order, covering Admin and Agent dashboards:

- Admin
  - Staff management panel: modify roles (including agents), manage accounts and bindings (Sealos/Feishu)
  - Knowledge base indexing: add indexing for "General Docs" and "Historical Tickets"
    - Historical ticket indexing: scheduled jobs (e.g., every 7/14 days)
    - General docs: upload, parse, and structure into unified knowledge entries
  - KB hit testing: test retrieval and answer quality without creating tickets
  - KB visualization: view and visualize starred/general/historical KB entries
  - Knowledge graph visualization: entities, relations, and weights
  - Prompt customization: visualize and A/B test the agent workflow prompts
  - Workflow orchestration: evolve the fixed workflow into a composable bot
- Analytics
  - Ticket distribution: by category (pie), feedback tickets ratio (pie)
  - KB hit rate: trend and distribution
  - Ticket volume: time series (line)
  - Feedback: time series (line) and star distribution (pie)
  - Handoff metrics: human-handoff vs. non-handoff vs. total
- Agent dashboard and features
  - KB hit testing entry point
  - Index management and visualization
  - Personal ticket metrics:
    - Assigned/participated/related ticket counts (filters: handed-off/not handed-off/all)
    - Distribution by module and trends

Todo summary:

- [ ] Admin: Staff management and account binding (Sealos/Feishu)
- [ ] Admin: General docs and historical ticket indexing (with schedules)
- [ ] Admin: KB hit testing and visualization
- [ ] Admin: Prompt customization and workflow orchestration
- [ ] Analytics: Ticket distribution, hit rate, volume, and feedback trends
- [ ] Agent: Hit testing and index visualization; personal metrics dashboard

## 🤝 Contributing

### Submit Code

1. Fork the project to your GitHub account
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'feat: your change'`
4. Push branch: `git push origin feature/your-feature`
5. Create Pull Request (PR)

### Commit Message Standards

Use [Conventional Commits](https://www.conventionalcommits.org/) standards:

```text
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update dependencies
```

### Code Review

All code changes must go through Pull Request review:

- Ensure all tests pass
- Follow project code standards
- Add necessary documentation and comments
- Update related test cases

## 🆘 Support

If you encounter problems or have questions:

1. Check if there are similar issues in [Issues](../../issues)
2. Create a new Issue describing your problem
3. Contact project maintainers

---

Happy Coding! 🎉
