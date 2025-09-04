# Tentix = Ten (10x 效率) Tix (工单系统)

[English](README.md) | [中文](README.zh-CN.md)

基于 AI 的客服平台，提供 10 倍加速的解决方案。

- 🚀 10 倍更快的响应速度
- 🤖 10 倍减少人工干预
- 😊 10 倍提升用户满意度

![image](https://github.com/user-attachments/assets/798dbbd3-4b78-4412-bf69-fda27f12d128)

## 🖥 在 Sealos 上体验

在应用市场一键部署，只需配置一个 ai 客服，一个员工，即可体验。

[![](https://raw.githubusercontent.com/labring-actions/templates/main/Deploy-on-Sealos.svg)](https://bja.sealos.run/?openapp=system-template%3FtemplateName%3Dtentix)

## 目录

- [核心架构](#核心架构)
- [已实现特性](#已实现特性)
- [部署要求](#部署要求)
- [部署](#部署)
- [开发指南](#开发指南)
- [路线图](#路线图)

## 核心架构

```mermaid
graph TD
    A[工单数据源] --> B[知识库构建模块]
    C[通用文档] --> B
    D[收藏对话] --> B

    B --> E[统一向量知识库<br/>PostgreSQL + pgvector]

    E --> F[LangGraph AI Agent]

    G[用户消息] --> H[查询提炼模块]
    I[工单信息] --> H

    H --> J[知识检索模块]
    E --> J

    J --> F
    F --> K[生成回复]

    subgraph "知识来源优先级"
        L[1. 收藏对话<br/>权重: 1.0]
        M[2. 历史工单<br/>权重: 0.8]
        N[3. 通用知识<br/>权重: 0.6]
    end
```

```mermaid
graph TD
    A[开始构建] --> B{选择知识类型}

    B -->|收藏对话| C[提取收藏的工单/消息]
    B -->|历史工单| D[筛选高质量已解决工单]
    B -->|通用知识| E[加载文档文件]

    C --> F[AI增强处理<br/>生成摘要和检索词]
    D --> G[构建工单文档<br/>提取关键对话]
    E --> H[文档分块处理]

    F --> I[向量化处理]
    G --> I
    H --> I

    I --> J[存储到统一知识库]
    J --> K[完成]
```

## 已实现特性

- 客服聊天系统
- AI 能力（LangGraph 工作流：分析 → 生成查询 → 检索 → 生成答复）
- 多渠道通知推送,飞书已支持，其它 IM/表单可按模块化接入
- 🔧 可扩展架构：模块化设计，支持按需扩展
- 统一认证设计：插拔式配置第三方接口，便于对接第三方系统
- 向量后端：支持 PostgreSQL + pgvector 或外部向量服务切换 (FastGPT)
- Agent 模型配置：在后台预留模型/温度/TopP/最大 Token 等参数位

## 部署要求

- Bun ≥ 1.2.16
- PostgreSQL（支持 pgvector 扩展）
- MinIO（或兼容的对象存储）
- OpenAI/FastGPT 等 AI 服务凭证

## 部署

### 1. 通过 Dockerfile 构建镜像

```bash
docker build -t tentix:latest .
```

### 2. 配置 PostgreSQL 完成数据库同步

> 说明：迁移脚本会读取项目根目录的 `.env.local`，需要配置 DATABASE_URL。

```bash
cd server
bun run migrate
```

### 3. 配置应用必须的环境变量

- 必需（必须配置）：

```bash
DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DB"

# 生成 Base64 加密密钥（在 server 目录执行）
#   cd server && bun run script/getCryptoKey.ts
ENCRYPTION_KEY="<上一步生成的Base64密钥>"

# 存储对话中的图片等多媒体
MINIO_ACCESS_KEY="<minio-access-key>"
MINIO_SECRET_KEY="<minio-secret-key>"
MINIO_BUCKET="<bucket-name>"
MINIO_ENDPOINT="<http(s)://host:port>"  # 例如：http://minio:9000
```

- AI 相关（按需配置）：

```bash
OPENAI_BASE_URL="<https://api.openai.com/v1>"
OPENAI_API_KEY="<openai-api-key>"
SUMMARY_MODEL="<用于摘要的模型名>"
EMBEDDING_MODEL="<用于向量化的模型名>"
CHAT_MODEL="<用于对话的模型名>"
FAST_MODEL="<用于快速响应的模型名>"
MAX_AI_RESPONSES_PER_TICKET=3  # 单工单 AI 回复次数上限，默认 3
```

- 可选（飞书群聊与员工推送）：

```bash
FEISHU_APP_ID="<feishu-app-id>"
FEISHU_APP_SECRET="<feishu-app-secret>"
FEISHU_CHAT_ID="<feishu-chat-id>"
APP_URL="<对外可访问的应用地址>"
```

### 5. 运行容器

```bash
docker run -d \
  --name tentix \
  -p 3000:3000 \
  --env-file ./.env.local \
  tentix:latest
```

- 健康检查：`/health`
- 默认端口：`3000`

## 开发指南

> 开发帮助：可参阅 [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) · [server/README.md](server/README.md) · [frontend/README.md](frontend/README.md)

按以下步骤快速启动本地开发环境。

### 克隆与安装

```bash
git clone https://github.com/labring/tentix.git
cd tentix
bun install
```

### 配置数据库与迁移

> 说明：迁移脚本会读取项目根目录的 `.env.local`，需要先配置 `DATABASE_URL`。

你可以在 [Sealos 控制台](https://bja.sealos.run/) 启用一个 PostgreSQL 数据库，Sealos 提供便捷的数据库创建与自带管理工具。

```bash
# 在项目根目录创建/编辑 .env.local，至少包含：
echo 'DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/DB"' >> .env.local

# 进入 server 并执行迁移
cd server
bun run migrate
```

完成数据库同步。

### 配置环境变量

```bash
cp .env.template .env.local
# 按需补全/覆盖 .env.local 中的变量（如 ENCRYPTION_KEY、MINIO_*、OPENAI_* 等）
```

> 提示：如需生成 `ENCRYPTION_KEY`，在 `server` 下执行 `bun run script/getCryptoKey.ts`，将结果填写到 `.env.local`。

### 启动开发环境

```bash
cd ..  # 回到项目根目录（若当前在 server 下）
bun run dev
```

### 常用命令

```bash
bun run lint
bun run typecheck
bun run format
bun run build
# Dry run build for testing and check build errors
bun run build --dry
# Force build
bun run build --force
```

## 路线图

以下为优先级排序的功能规划，覆盖 Admin 与 客服端 数据面板：

- Admin 功能
  - 人员管理面板：修改角色（含客服），管理账号与绑定（Sealos/飞书）
  - 知识库索引：新增“通用文档”和“历史工单”的索引能力
    - 历史工单索引：支持定时任务（如每 7/14 天）
    - 通用文档：上传、解析与结构化抽取，形成统一知识条目
  - 知识库命中测试：无需新建工单即可测试检索命中与答复质量
  - 知识库图形面板：收藏对话/通用文档/历史工单的索引查看与可视化
  - 知识图谱可视化：知识条目、关系与权重的图形化展示
  - 提示词定制化：Agent 工作流提示词可视化配置与 A/B 实验
  - 工作流编排：将当前固定工作流演进为可编排机器人模式
- 数据分析面板
  - 工单分布：按种类的饼图、反馈工单占比（饼图）
  - 知识库命中率：趋势与分布
  - 工单数量：按时间分布（折线图）
  - 工单反馈数据：按时间（折线）与星级占比（饼图）
  - 转人工数据：转人工/未转人工/总量对比
- 客服端面板与功能
  - 知识库命中测试入口
  - 索引管理与可视化查看
  - 个人工单指标：
    - 分派给自己/参与的/与自己有关的工单量（支持过滤：转人工/未转人工/全部）
    - 按模块分布的统计与趋势

Todo 列表（摘要）：

- [ ] Admin：人员管理与账号绑定（Sealos/飞书）
- [ ] Admin：通用文档与历史工单索引（含定时任务）
- [ ] Admin：知识库命中测试与图形面板
- [ ] Admin：提示词定制化与工作流编排
- [ ] 分析：工单分布、命中率、数量与反馈趋势
- [ ] 客服端：命中测试与索引可视化；个人指标看板

## 🤝 参与贡献

### 提交代码

1. Fork 本项目到你的 GitHub 账号
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交变更：`git commit -m 'feat: your change'`
4. 推送分支：`git push origin feature/your-feature`
5. 发起 Pull Request（PR）

### 提交信息规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update dependencies
```

### 代码评审

所有代码变更需要通过 Pull Request 进行评审：

- 确保所有测试通过
- 遵循项目的代码规范
- 补充必要的文档与注释
- 更新相关测试用例

## 🆘 支持

如遇到问题或有疑问：

1. 先在 [Issues](../../issues) 中搜索是否已有类似问题
2. 新建 Issue 详细描述你的问题
3. 联系项目维护者

---

**祝编码愉快！🎉**
