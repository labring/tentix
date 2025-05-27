# ESLint Config Changelog

## 2024-01-XX - Major Configuration Update

### 🎉 新功能
- 创建了完整的 server.js 配置文件，用于 Node.js 服务器端代码
- 添加了 index.js 主入口文件，方便统一导入所有配置
- 更新了 package.json 的 exports 字段，支持所有配置文件的导出

### 🔧 改进
- **base.js**: 
  - 添加了更多通用的代码质量规则
  - 改进了 ignore 模式，包含更多常见的构建输出目录
  - 移除了不存在的 `@typescript-eslint/prefer-const` 规则

- **react-internal.js**: 
  - 移除了重复的基础配置导入
  - 添加了更多 React 相关的规则
  - 优化了配置结构

- **frontend.js**: 
  - 移除了重复的基础配置导入
  - 添加了 Next.js 特定的优化规则
  - 改进了 React Hooks 规则配置

- **server.js**: 
  - 全新创建，专门用于 Node.js 服务器端代码
  - 包含 Node.js 特定的全局变量和规则
  - 配置了合适的 TypeScript 规则

### 🏗️ 项目结构改进
- 迁移到 ESLint 9.x 的 flat config 格式
- 更新了根目录的 `eslint.config.mjs`
- 为 frontend 和 server 目录创建了独立的 eslint 配置文件
- 更新了 `turbo.json` 以支持新的配置文件格式

### 📝 文档更新
- 更新了 README.md，提供了详细的使用说明
- 添加了所有配置的使用示例

### 🐛 修复
- 修复了不存在的 ESLint 规则引用
- 解决了配置重复导入的问题
- 调整了警告阈值，使其更适合开发环境

### 📦 配置文件结构
```
packages/eslint-config/
├── index.js          # 主入口文件
├── base.js           # 基础配置
├── react-internal.js # React 组件库配置
├── frontend.js       # Next.js 前端配置
├── server.js         # Node.js 服务器配置
├── package.json      # 包配置
└── README.md         # 使用文档
```

### 🎯 使用方式
各个项目现在可以根据需要导入相应的配置：

```javascript
// 基础配置
import { config } from "@workspace/eslint-config/base";

// React 组件库
import { config } from "@workspace/eslint-config/react-internal";

// Next.js 前端
import { config } from "@workspace/eslint-config/frontend";

// Node.js 服务器
import { config } from "@workspace/eslint-config/server";
``` 