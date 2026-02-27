# 贡献指南 / Contributing Guide

感谢你有兴趣为**众支付（ZhongPay）**做出贡献！本项目由 **AME & Entertainment** 开发维护，欢迎社区参与。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境搭建](#开发环境搭建)
- [提交规范](#提交规范)
- [代码规范](#代码规范)
- [版权说明](#版权说明)

---

## 行为准则

参与本项目即表示你同意遵守 [行为准则](CODE_OF_CONDUCT.md)。我们致力于维护一个友好、包容的开源社区。

---

## 如何贡献

### 🐛 报告 Bug

1. 先搜索 [已有 Issues](https://github.com/AME-dev/zhong-pay/issues)，确认未被报告
2. 使用 [Bug 报告模板](https://github.com/AME-dev/zhong-pay/issues/new?template=bug_report.md) 提交

### 💡 提出功能建议

1. 先在 [Discussions](https://github.com/AME-dev/zhong-pay/discussions) 讨论可行性
2. 使用 [功能建议模板](https://github.com/AME-dev/zhong-pay/issues/new?template=feature_request.md) 提交

### 🔧 提交代码

1. Fork 本仓库
2. 基于 `main` 创建功能分支：`git checkout -b feat/your-feature`
3. 完成开发并确保测试通过
4. 提交符合规范的 commit
5. 推送并创建 Pull Request

---

## 开发环境搭建

```bash
# 1. Fork & Clone
git clone https://github.com/YOUR_USERNAME/zhong-pay.git
cd zhong-pay

# 2. 安装依赖
npm run install:all

# 3. 配置环境变量
cp packages/server/.env.example packages/server/.env
# 编辑 .env 填写本地数据库配置

# 4. 初始化数据库
npm run db:migrate
npm run db:seed

# 5. 启动开发服务
npm run dev
```

### 分支命名规范

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能 | `feat/描述` | `feat/wechat-v3-api` |
| 修复 | `fix/描述` | `fix/alipay-notify-verify` |
| 文档 | `docs/描述` | `docs/deploy-guide` |
| 重构 | `refactor/描述` | `refactor/prisma-client` |

---

## 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范：

```
<type>(<scope>): <subject>

[可选正文]

[可选脚注]
```

### 类型（type）

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响功能）|
| `refactor` | 重构（不修改功能）|
| `perf` | 性能优化 |
| `test` | 添加/修改测试 |
| `chore` | 构建、依赖等杂项变更 |
| `ci` | CI/CD 配置变更 |

### 示例

```bash
feat(pay): 新增支付宝 APP 支付渠道
fix(notify): 修复微信回调签名验证失败问题
docs(deploy): 更新 Cloudflare 部署文档
```

---

## 代码规范

- **TypeScript**：所有代码必须有类型声明，禁止 `any`（特殊情况加注释说明）
- **命名**：变量/函数使用 camelCase，类/接口使用 PascalCase，常量使用 UPPER_SNAKE_CASE
- **注释**：公共函数须有 JSDoc 注释，复杂逻辑须有行内注释
- **导入**：按 外部依赖 → 内部模块 → 类型 的顺序排列

---

## 版权说明

> **重要**：向本项目提交代码，即表示你同意将贡献内容授权给本项目，贡献代码将遵循 [Apache License 2.0](LICENSE) 协议。
>
> 本项目**技术维护及版权归属 AME & Entertainment**。贡献者的姓名将被记录在提交历史和致谢名单中。

---

感谢你的贡献！如有任何问题，欢迎在 [Discussions](https://github.com/AME-dev/zhong-pay/discussions) 交流。

**AME & Entertainment** · [GitHub](https://github.com/AME-dev) · [官网](https://ame.dev)
