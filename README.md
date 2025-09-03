# Tentix = Ten (10x Efficiency) Tix (Ticket System)

[English](README.md) | [中文](README.zh-CN.md)

A FastGPT-powered AI customer service platform with 10x accelerated resolution.

- 🚀 10x Faster Response Speed
- 🤖 10x Reduced Human Intervention
- 😊 10x Improved User Satisfaction

![image](https://github.com/user-attachments/assets/798dbbd3-4b78-4412-bf69-fda27f12d128)

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Development Guide](#development-guide)
- [Database Scripts](#database-scripts)
- [Configuration Files](#configuration-files)
- [Deployment Guide](#deployment-guide)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)

## 🎯 Project Overview

Tentix is a modern AI-driven customer service system built with Monorepo architecture, integrating frontend interface, backend API, and AI processing capabilities. The system supports multi-channel integration (Feishu, etc.) and provides intelligent ticket processing, automatic replies, and seamless human-AI handover functionality.

### Core Features

- 🤖 **AI Smart Customer Service**: Intelligent conversation system based on FastGPT
- 📱 **Multi-Channel Integration**: Support for Feishu, WeChat and other platforms
- 🎫 **Ticket Management**: Complete ticket lifecycle management
- 👥 **Team Collaboration**: Support for multi-department, multi-role collaboration
- 📊 **Data Analytics**: Real-time monitoring and data statistics
- 🔧 **Scalable Architecture**: Modular design, easy to extend

## 🛠 Tech Stack

### Frontend Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 6.1
- **Routing**: TanStack Router
- **State Management**: Zustand + TanStack Query
- **UI Components**: Custom UI component library + Tailwind CSS 4.0
- **Rich Text Editor**: TipTap
- **Code Highlighting**: React Syntax Highlighter

### Backend Tech Stack

- **Runtime**: Bun
- **Framework**: Hono 4.7
- **Database**: PostgreSQL + Drizzle ORM
- **API Documentation**: OpenAPI + Scalar
- **File Storage**: MinIO
- **Caching**: Node Cache
- **Rate Limiting**: Hono Rate Limiter

### Development Tools

- **Monorepo**: Turborepo
- **Package Manager**: Bun
- **Code Standards**: ESLint + Prettier
- **Type Checking**: TypeScript 5.8
- **Containerization**: Docker + Docker Compose

## 📁 Project Structure

```
tentix-v2/
├── frontend/                 # Frontend application
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── routes/          # Route pages
│   │   ├── store/           # State management
│   │   ├── hooks/           # Custom Hooks
│   │   ├── lib/             # Utility libraries
│   │   └── modal/           # Modal components
│   ├── public/              # Static assets
│   └── package.json
├── server/                   # Backend service
│   ├── api/                 # API routes
│   ├── db/                  # Database configuration
│   ├── utils/               # Utility functions
│   ├── types/               # Type definitions
│   ├── script/              # Script files
│   ├── config.*.json        # Configuration files
│   └── package.json
├── packages/                 # Shared packages
│   ├── ui/                  # UI component library
│   ├── i18n/                # Internationalization
│   ├── eslint-config/       # ESLint configuration
│   └── typescript-config/   # TypeScript configuration
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile               # Docker image configuration
├── Makefile                 # Build scripts
├── turbo.json               # Turborepo configuration
└── package.json             # Root package configuration
```

## 🚀 Quick Start

### Environment Requirements

- Node.js >= 20
- Bun >= 1.2.16
- PostgreSQL
- Docker (optional)

### Install Dependencies

```bash
bun install
```

This Monorepo can only use Bun as the package manager.

### Environment Configuration

1. Generate encryption key:

```bash
cd server
bun run script/getCryptoKey.ts
```

2. Copy configuration file template:

```bash
cp server/config.template.json server/config.dev.json
```

3. Configure environment variables:

```bash
cp .env.template .env.local
# Add the generated encryption key to .env.local
```

4. Initialize database:

```bash
cd server
bun run script/initDB.ts
```

5. (Optional) Generate seed data for development:

```bash
cd server
bun run seed
```

For detailed configuration instructions, see [Configuration Files](#configuration-files) and [Database Scripts](#database-scripts) sections.

### Start Development Server

```bash
# Start development environment
bun run dev

# Or use Make command
make dev
```

Visit http://localhost:5173 to view the frontend application
Visit http://localhost:3000/api/reference to view the backend API

## 💻 Development Guide

### Development Commands

```bash
# Development environment
bun run dev              # Start development server
bun run build            # Build project
bun run lint             # Code linting
bun run format           # Code formatting
bun run typecheck        # Type checking
bun run test             # Run tests

# Database operations
cd server
bun run generate         # Generate database migrations
bun run migrate          # Execute database migrations
bun run studio           # Open Drizzle Studio
bun run seed             # Database seed data

# Database utility scripts
bun run script/getCryptoKey.ts      # Generate encryption keys
bun run script/resetDB.ts           # Reset database completely
bun run script/seed.ts  # Generate seed data for development and testing

# Helpful Bash Command
rm -rf ./**/turbo ./**/node_modules ./**/output ./**/dist
```

### Code Standards

The project uses ESLint + Prettier for code standards management:

- Use TypeScript strict mode
- Follow React Hooks conventions
- Components use PascalCase naming
- Files use kebab-case naming
- Automatically run lint checks before commits

### Development Workflow

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Develop feature**: Follow code standards for development
3. **Run tests**: `bun run test` to ensure tests pass
4. **Code checking**: `bun run lint` to fix code issues
5. **Commit code**: Use standardized commit messages
6. **Create PR**: Submit Pull Request for code review

## 🗄️ Database Scripts

The project includes several utility scripts for database management and system initialization. These scripts are located in `server/script/` and handle various aspects of database setup, user management, and data migration.

### Available Scripts

- **`getCryptoKey.ts`**: Generate secure AES-256 encryption keys for the application
- **`initDB.ts`**: Initialize database with system users, AI user, and staff members
- **`resetDB.ts`**: Completely reset database schema and regenerate migrations
- **`migrateStaffList.ts`**: Fetch and migrate staff data from Feishu platform
- **`seed.ts`**: Generate realistic seed data for development and testing

### Quick Setup Workflow

```bash
# 1. Generate encryption key
cd server && bun run script/getCryptoKey.ts

# 2. Initialize database
bun run script/initDB.ts

# 3. (Optional) Generate test data
bun run seed
```

For detailed information about each script, including usage examples, configuration requirements, and troubleshooting, see the [**Scripts Documentation**](SCRIPTS.md).

## ⚙️ Configuration Files

### Server Configuration (`server/config.*.json`)

```json
{
  "$schema": "./config.schema.json",
  "feishu_app_id": "your_feishu_app_id",
  "feishu_app_secret": "your_feishu_app_secret",
  "aiProfile": {
    "uid": "0",
    "name": "Tentix AI",
    "nickname": "Tentix AI",
    "role": "ai",
    "avatar": "avatar_url"
  },
  "department_ids": ["department_id"],
  "agents_ids": ["agent_id"],
  "admin_ids": ["admin_id"],
  "staffs": [],
  "departments": []
}
```

### Environment Variables (`.env.local`)

```bash
# Database configuration
DATABASE_URL=postgresql://username:password@localhost:5432/tentix
ENCRYPTION_KEY="q1cRtBG7J9YyFlPmeynwlJ1B+5Nu0SOa+hAUtUhh9lk="

# MinIO configuration
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET=your_bucket_name
MINIO_ENDPOINT=your_minio_endpoint

# FastGPT configuration
FASTGPT_API_URL=your_fastgpt_api_url
FASTGPT_API_KEY=your_fastgpt_api_key
FASTGPT_API_LIMIT=50

# Other configuration
NODE_ENV=development
```

### Configuration File Description

- `config.dev.json`: Development environment configuration
- `config.prod.json`: Production environment configuration
- `config.template.json`: Configuration template file
- `config.schema.json`: Configuration file JSON Schema

## 🚢 Deployment Guide

### Docker Deployment (Recommended)

#### Production Environment Deployment

```bash
# Deploy using Docker Compose
make docker-up

# Or use docker-compose directly
docker-compose up -d --build
```

#### Development Environment Build Testing

```bash
# Start development environment
make docker-dev

# Or use docker-compose
docker-compose --profile dev up --build
```

### Manual Deployment

```bash
# 1. Build project
bun run build

# 2. Start production server
bun run start

# Dry run build for testing and check build errors
bun run build --dry

# Force build
bun run build --force

# Or use PM2
pm2 start bun --name tentix -- run start
```

### Deploy to Cloud Server

```bash
# 1. Build Docker image
make build

# 2. Push to image registry
make push DOCKER_REGISTRY=your-registry

# 3. Pull and run on server
docker pull your-registry/tentix:latest
docker run -d -p 3000:3000 your-registry/tentix:latest
```

### Health Check

After deployment, you can check service status through the following endpoints:

- Health check: `GET /health`
- API documentation: `GET /api/reference`
- Service status: `GET /api/status`

## 📚 API Documentation

### Access API Documentation

After starting the service, visit the following addresses to view API documentation:

- **Scalar UI**: http://localhost:3000/api/reference
- **OpenAPI JSON**: http://localhost:3000/openapi.json

### Main API Endpoints

```
GET    /api/health          # Health check
POST   /api/auth/login      # User login
GET    /api/tickets         # Get ticket list
POST   /api/tickets         # Create ticket
GET    /api/tickets/:id     # Get ticket details
PUT    /api/tickets/:id     # Update ticket
DELETE /api/tickets/:id     # Delete ticket
```

### Authentication Method

API uses Bearer Token authentication:

```bash
curl -H "Authorization: Bearer your-token" \
     http://localhost:3000/api/tickets
```

## 🤝 Contributing

### Submit Code

1. Fork the project to your GitHub account
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Create Pull Request

### Commit Message Standards

Use [Conventional Commits](https://www.conventionalcommits.org/) standards:

```
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update dependencies
```

### Code Review

All code changes need to go through Pull Request review:

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

**Happy Coding! 🎉**
