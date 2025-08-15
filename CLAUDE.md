# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Start development server (both frontend and backend)
bun run dev

# Alternative using Make
make dev

# Build the entire project
bun run build

# Run linting
bun run lint

# Run type checking
bun run typecheck

# Format code
bun run format
```

### Database Operations
```bash
cd server

# Generate database migrations
bun run generate

# Apply database migrations
bun run migrate

# Open Drizzle Studio (database GUI)
bun run studio

# Generate seed data for development
bun run seed

# Database utility scripts
bun run script/getCryptoKey.ts      # Generate encryption keys
bun run script/initDB.ts            # Initialize database with users
bun run script/resetDB.ts           # Reset database completely
bun run script/migrateStaffList.ts  # Migrate staff from Feishu
```

### Package-Specific Commands
```bash
# Frontend-specific
cd frontend
bun run dev          # Start frontend dev server
bun run build        # Build frontend
bun run test         # Run frontend tests
bun run typecheck    # Frontend type checking

# Server-specific
cd server
bun run dev          # Start backend dev server with hot reload
bun run build        # Build backend
bun run start        # Start production server
```

### Docker Commands
```bash
# Development with Docker
make docker-dev

# Production deployment
make docker-up

# Stop containers
make docker-down

# View logs
make docker-logs
```

### Shadcn UI Components
When adding new UI components, use this command in the frontend directory:
```bash
pnpx shadcn@latest add button
```

## Project Architecture

### Core Technology Stack
- **Runtime**: Bun (package manager and JavaScript runtime)
- **Monorepo**: Turborepo for build orchestration
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Hono framework with Bun runtime
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Custom UI components + Tailwind CSS 4.0
- **State Management**: Zustand + TanStack Query
- **Routing**: TanStack Router
- **Authentication**: JWT with custom encryption

### Monorepo Structure
```
tentix/
├── frontend/           # React application
├── server/            # Hono API server
├── packages/          # Shared packages
│   ├── ui/           # Shared UI components
│   ├── i18n/         # Internationalization
│   ├── eslint-config/    # ESLint configuration
│   └── typescript-config/ # TypeScript configuration
```

### Key Architecture Patterns

#### RPC Type Safety
The project uses Hono's RPC feature for end-to-end type safety between client and server:
- Server exports `AppType` from `server/api/index.ts`
- Frontend imports this type for type-safe API calls
- All API routes are strongly typed with Zod validation

#### Database Schema Design
The database uses a PostgreSQL schema with the following key entities:
- **Users**: Multi-role system (customer, staff, admin, ai)
- **Tickets**: Core ticketing system with status, priority, categories
- **Chat Messages**: Real-time messaging with TipTap JSON content
- **Feedback System**: Message feedback, staff feedback, and ticket feedback
- **Message Read Status**: Track which messages have been read by which users

#### State Management
- **Zustand stores** in `frontend/src/store/`:
  - Ticket store for current ticket state
  - Chat store for message management
  - Session members store for participant tracking
- **TanStack Query** for server state caching and synchronization

#### Real-time Communication
- WebSocket integration for real-time chat
- Server-Sent Events (SSE) for live updates
- Message deduplication and read status tracking

### Important Implementation Details

#### Package Manager Constraints
- **MUST use Bun exclusively** - no npm, yarn, or pnpm
- Uses `workspace:*` protocol for internal dependencies
- All workspaces defined in root `package.json`

#### Build System
- Turborepo orchestrates builds with dependency awareness
- TypeScript project references for incremental compilation
- Vite for frontend bundling with hot reload

#### Configuration Management
- Environment-specific config files: `config.dev.json`, `config.prod.json`
- Schema validation with `config.schema.json`
- Encryption keys required for JWT token handling

#### Database Migrations
- Drizzle ORM with schema-first approach
- Migration files in `server/db/codegen/`
- All database operations require environment file: `--env-file=../.env.local`

#### API Structure
The server API is organized by domain:
- `/api/auth` - Authentication endpoints
- `/api/user` - User management
- `/api/ticket` - Ticket CRUD operations
- `/api/chat` - Real-time messaging
- `/api/file` - File upload/download
- `/api/admin` - Administrative functions
- `/api/feishu` - Feishu platform integration
- `/api/feedback` - Feedback system
- `/api/playground` - Development testing (non-production)

#### Frontend Routing
- File-based routing with TanStack Router
- Route generation via `routeTree.gen.ts`
- Separate user and staff interfaces:
  - `/user/*` - Customer interface
  - `/staff/*` - Staff dashboard

## Development Workflow

### Before Making Changes
1. Ensure you're using Bun: `bun --version` should show >= 1.2.16
2. Install dependencies: `bun install`
3. Set up database: Follow the database setup steps in README.md
4. Start development: `bun run dev`

### Code Standards
- ESLint + Prettier configuration shared across packages
- TypeScript strict mode enabled
- Maximum 150 ESLint warnings allowed in frontend
- Use kebab-case for file names, PascalCase for components

### Testing
- Frontend tests with Vitest and React Testing Library
- Server tests with Bun test runner
- Test files co-located with source code

### Common Gotchas
- Database operations require `cd server` first due to path dependencies
- Frontend build depends on server type definitions being built first
- WebSocket connections are handled separately from HTTP routes
- Message IDs have complex mapping between temporary and real IDs for optimistic updates

### Environment Setup
1. Copy `server/config.template.json` to `server/config.dev.json`
2. Generate encryption key: `cd server && bun run script/getCryptoKey.ts`
3. Set up `.env.local` with database URL and encryption key
4. Initialize database: `cd server && bun run script/initDB.ts`
5. Optionally generate seed data: `cd server && bun run seed`