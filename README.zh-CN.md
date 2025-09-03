# Tentix = Ten (10x 效率) Tix (工单系统)

[English](README.md) | [中文](README.zh-CN.md)

一个基于 FastGPT 的 AI 客服平台，提供 10 倍加速的解决方案。

* 🚀 10 倍更快的响应速度
* 🤖 10 倍减少人工干预
* 😊 10 倍提升用户满意度

![image](https://github.com/user-attachments/assets/798dbbd3-4b78-4412-bf69-fda27f12d128)

## 📋 目录

- [项目概述](#项目概述)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [数据库脚本](#数据库脚本)
- [配置文件](#配置文件)
- [部署指南](#部署指南)
- [API 文档](#api-文档)
- [贡献指南](#贡献指南)

## 🎯 项目概述

Tentix 是一个基于 Monorepo 架构构建的现代化 AI 驱动客服系统，集成了前端界面、后端 API 和 AI 处理能力。系统支持多渠道集成（飞书等），提供智能工单处理、自动回复和无缝的人机交接功能。

### 核心功能

- 🤖 **AI 智能客服**：基于 FastGPT 的智能对话系统
- 📱 **多渠道集成**：支持飞书、微信等平台
- 🎫 **工单管理**：完整的工单生命周期管理
- 👥 **团队协作**：支持多部门、多角色协作
- 📊 **数据分析**：实时监控和数据统计
- 🔧 **可扩展架构**：模块化设计，易于扩展

## 🛠 技术栈

### 前端技术栈
- **框架**：React 19 + TypeScript
- **构建工具**：Vite 6.1
- **路由**：TanStack Router
- **状态管理**：Zustand + TanStack Query
- **UI 组件**：自定义 UI 组件库 + Tailwind CSS 4.0
- **富文本编辑器**：TipTap
- **代码高亮**：React Syntax Highlighter

### 后端技术栈
- **运行时**：Bun
- **框架**：Hono 4.7
- **数据库**：PostgreSQL + Drizzle ORM
- **API 文档**：OpenAPI + Scalar
- **文件存储**：MinIO
- **缓存**：Node Cache
- **限流**：Hono Rate Limiter

### 开发工具
- **Monorepo**：Turborepo
- **包管理器**：Bun
- **代码规范**：ESLint + Prettier
- **类型检查**：TypeScript 5.8
- **容器化**：Docker + Docker Compose

## 📁 项目结构

```
tentix-v2/
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # UI 组件
│   │   ├── routes/          # 路由页面
│   │   ├── store/           # 状态管理
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── lib/             # 工具库
│   │   └── modal/           # 模态框组件
│   ├── public/              # 静态资源
│   └── package.json
├── server/                   # 后端服务
│   ├── api/                 # API 路由
│   ├── db/                  # 数据库配置
│   ├── utils/               # 工具函数
│   ├── types/               # 类型定义
│   ├── script/              # 脚本文件
│   ├── config.*.json        # 配置文件
│   └── package.json
├── packages/                 # 共享包
│   ├── ui/                  # UI 组件库
│   ├── i18n/                # 国际化
│   ├── eslint-config/       # ESLint 配置
│   └── typescript-config/   # TypeScript 配置
├── docker-compose.yml        # Docker Compose 配置
├── Dockerfile               # Docker 镜像配置
├── Makefile                 # 构建脚本
├── turbo.json               # Turborepo 配置
└── package.json             # 根包配置
```

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- Bun >= 1.2.16
- PostgreSQL
- Docker（可选）

### 安装依赖

```bash
bun install
```

此 Monorepo 只能使用 Bun 作为包管理器。

### 环境配置

1. 生成加密密钥：
```bash
cd server
bun run script/getCryptoKey.ts
```

2. 复制配置文件模板：
```bash
cp server/config.template.json server/config.dev.json
```

3. 配置环境变量：
```bash
cp .env.template .env.local
# 将生成的加密密钥添加到 .env.local
```

4. 初始化数据库：
```bash
cd server
bun run script/initDB.ts
```

5. （可选）生成开发用的种子数据：
```bash
cd server
bun run seed
```

详细配置说明请参考 [配置文件](#配置文件) 和 [数据库脚本](#数据库脚本) 部分。

### 启动开发服务器

```bash
# 启动开发环境
bun run dev

# 或使用 Make 命令
make dev
```

访问 http://localhost:5173 查看前端应用
访问 http://localhost:3000/api/reference 查看后端 API

## 💻 开发指南

### 开发命令

```bash
# 开发环境
bun run dev              # 启动开发服务器
bun run build            # 构建项目
bun run lint             # 代码检查
bun run format           # 代码格式化
bun run typecheck        # 类型检查
bun run test             # 运行测试

# 数据库操作
cd server
bun run generate         # 生成数据库迁移
bun run migrate          # 执行数据库迁移
bun run studio           # 打开 Drizzle Studio
bun run seed             # 数据库种子数据

# 数据库工具脚本
bun run script/getCryptoKey.ts      # 生成加密密钥
bun run script/initDB.ts            # 初始化数据库和用户
bun run script/resetDB.ts           # 完全重置数据库
bun run script/migrateStaffList.ts  # 从飞书迁移员工

# 有用的 Bash 命令
rm -rf ./**/turbo ./**/node_modules ./**/output ./**/dist
```

### 代码规范

项目使用 ESLint + Prettier 进行代码规范管理：

- 使用 TypeScript 严格模式
- 遵循 React Hooks 约定
- 组件使用 PascalCase 命名
- 文件使用 kebab-case 命名
- 提交前自动运行 lint 检查

### 开发工作流

1. **创建功能分支**：`git checkout -b feature/your-feature`
2. **开发功能**：遵循代码规范进行开发
3. **运行测试**：`bun run test` 确保测试通过
4. **代码检查**：`bun run lint` 修复代码问题
5. **提交代码**：使用标准化提交信息
6. **创建 PR**：提交 Pull Request 进行代码审查

## 🗄️ 数据库脚本

项目包含多个用于数据库管理和系统初始化的工具脚本。这些脚本位于 `server/script/` 目录中，处理数据库设置、用户管理和数据迁移的各个方面。

### 可用脚本

- **`getCryptoKey.ts`**：为应用程序生成安全的 AES-256 加密密钥
- **`initDB.ts`**：使用系统用户、AI 用户和员工初始化数据库
- **`resetDB.ts`**：完全重置数据库模式并重新生成迁移
- **`migrateStaffList.ts`**：从飞书平台获取并迁移员工数据
- **`seed.ts`**：为开发和测试生成真实的种子数据

### 快速设置工作流

```bash
# 1. 生成加密密钥
cd server && bun run script/getCryptoKey.ts

# 2. 初始化数据库
bun run script/initDB.ts

# 3. （可选）生成测试数据
bun run seed
```

有关每个脚本的详细信息，包括使用示例、配置要求和故障排除，请参阅 [**脚本文档**](SCRIPTS.md)。

## ⚙️ 配置文件

### 服务器配置（`server/config.*.json`）

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

### 环境变量（`.env.local`）

```bash
# 数据库配置
DATABASE_URL=postgresql://username:password@localhost:5432/tentix
ENCRYPTION_KEY="q1cRtBG7J9YyFlPmeynwlJ1B+5Nu0SOa+hAUtUhh9lk="

# MinIO 配置
MINIO_ACCESS_KEY=your_access_key
MINIO_SECRET_KEY=your_secret_key
MINIO_BUCKET=your_bucket_name
MINIO_ENDPOINT=your_minio_endpoint

# FastGPT 配置
FASTGPT_API_URL=your_fastgpt_api_url
FASTGPT_API_KEY=your_fastgpt_api_key
FASTGPT_API_LIMIT=50

# 其他配置
NODE_ENV=development
```

### 配置文件说明

- `config.dev.json`：开发环境配置
- `config.prod.json`：生产环境配置
- `config.template.json`：配置文件模板
- `config.schema.json`：配置文件 JSON Schema

## 🚢 部署指南

### Docker 部署（推荐）

#### 生产环境部署

```bash
# 使用 Docker Compose 部署
make docker-up

# 或直接使用 docker-compose
docker-compose up -d --build
```

#### 开发环境构建测试

```bash
# 启动开发环境
make docker-dev

# 或使用 docker-compose
docker-compose --profile dev up --build
```

### 手动部署

```bash
# 1. 构建项目
bun run build

# 2. 启动生产服务器
bun run start

# 或使用 PM2
pm2 start bun --name tentix -- run start
```

### 部署到云服务器

```bash
# 1. 构建 Docker 镜像
make build

# 2. 推送到镜像仓库
make push DOCKER_REGISTRY=your-registry

# 3. 在服务器上拉取并运行
docker pull your-registry/tentix:latest
docker run -d -p 3000:3000 your-registry/tentix:latest
```

### 健康检查

部署后，您可以通过以下端点检查服务状态：

- 健康检查：`GET /health`
- API 文档：`GET /api/reference`
- 服务状态：`GET /api/status`

## 📚 API 文档

### 访问 API 文档

启动服务后，访问以下地址查看 API 文档：

- **Scalar UI**：http://localhost:3000/api/reference
- **OpenAPI JSON**：http://localhost:3000/openapi.json

### 主要 API 端点

```
GET    /api/health          # 健康检查
POST   /api/auth/login      # 用户登录
GET    /api/tickets         # 获取工单列表
POST   /api/tickets         # 创建工单
GET    /api/tickets/:id     # 获取工单详情
PUT    /api/tickets/:id     # 更新工单
DELETE /api/tickets/:id     # 删除工单
```

### 认证方式

API 使用 Bearer Token 认证：

```bash
curl -H "Authorization: Bearer your-token" \
     http://localhost:3000/api/tickets
```

## 🤝 贡献指南

### 提交代码

1. Fork 项目到您的 GitHub 账户
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建 Pull Request

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 标准：

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 格式化代码
refactor: 重构代码
test: 添加测试
chore: 更新依赖
```

### 代码审查

所有代码更改都需要通过 Pull Request 审查：

- 确保所有测试通过
- 遵循项目代码规范
- 添加必要的文档和注释
- 更新相关测试用例

## 🆘 支持

如果您遇到问题或有疑问：

1. 检查 [Issues](../../issues) 中是否有类似问题
2. 创建新的 Issue 描述您的问题
3. 联系项目维护者

---

**祝您编码愉快！🎉**
