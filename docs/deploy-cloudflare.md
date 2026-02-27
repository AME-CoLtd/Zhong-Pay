# Cloudflare 部署文档

> **维护**：[AME](https://github.com/AME-CoLtd) · 版权归属 AME，基�?Apache 2.0 开�?
## 概述

Cloudflare 部署方案利用全球边缘网络，实现超低延迟访问：

| 组件 | 部署位置 | 说明 |
|------|----------|------|
| 前端管理后台 | Cloudflare Pages | 全球 CDN 加速静态资�?|
| 后端 API | Cloudflare Workers | 边缘运行时，基于 Hono 框架 |
| 限流 / 缓存 | Cloudflare KV | 分布式键值存�?|

数据库推荐（Workers 不支�?TCP 直连）：

| 推荐 | 说明 |
|------|------|
| [PlanetScale](https://planetscale.com) | MySQL 兼容，HTTP 协议连接 |
| [Neon](https://neon.tech) | PostgreSQL，支�?HTTP 驱动 |
| [Cloudflare D1](https://developers.cloudflare.com/d1/) | CF 原生 SQLite，延迟最�?|

## 准备工作

1. 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)
2. 安装 Wrangler CLI：`npm i -g wrangler`
3. 创建云数据库并获取连接字符串
4. �?CF 控制台创�?KV Namespace

## 快速部署（一键脚本）

```bash
bash scripts/deploy-cloudflare.sh
```

## 手动部署

### 第一步：登录 Cloudflare

```bash
wrangler login
```

### 第二步：创建 KV Namespace

```bash
# 创建 KV 命名空间
wrangler kv:namespace create "KV"
wrangler kv:namespace create "KV" --preview

# 输出示例:
# { binding: 'KV', id: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }
# { binding: 'KV', preview_id: 'yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy' }
```

将输出的 `id` �?`preview_id` 填入 `packages/worker/wrangler.toml`�?
```toml
[[kv_namespaces]]
binding = "KV"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
preview_id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

### 第三步：配置 Worker Secrets

```bash
cd packages/worker

# 必须配置的密�?wrangler secret put DATABASE_URL     # 数据库连接字符串
wrangler secret put JWT_SECRET       # JWT 签名密钥

# 支付宝配�?wrangler secret put ALIPAY_APP_ID
wrangler secret put ALIPAY_PRIVATE_KEY
wrangler secret put ALIPAY_PUBLIC_KEY
wrangler secret put ALIPAY_NOTIFY_URL

# 微信支付配置
wrangler secret put WECHAT_APP_ID
wrangler secret put WECHAT_MCH_ID
wrangler secret put WECHAT_API_KEY
wrangler secret put WECHAT_NOTIFY_URL
```

### 第四步：运行数据库迁�?
```bash
cd packages/server
DATABASE_URL="your-db-url" npx prisma migrate deploy
DATABASE_URL="your-db-url" npx ts-node prisma/seed.ts
```

### 第五步：部署 Worker

```bash
cd packages/worker
npm install
wrangler deploy --env production
# 输出 Worker URL: https://zhong-pay-worker.your-account.workers.dev
```

### 第六步：部署前端�?CF Pages

```bash
cd packages/admin
npm install
VITE_API_URL="https://zhong-pay-worker.your-account.workers.dev" npm run build

# 创建 Pages 项目（首次）
wrangler pages project create zhong-pay-admin --production-branch=main

# 部署
wrangler pages deploy dist --project-name=zhong-pay-admin
```

## 配置自定义域�?
### Worker 自定义域�?
�?`wrangler.toml` 中配置路由：

```toml
[routes]
pattern = "api.yourdomain.com/*"
zone_name = "yourdomain.com"
```

### Pages 自定义域�?
1. CF Pages 控制�?�?项目 �?Custom domains
2. 添加 `admin.yourdomain.com`
3. CF 会自动配�?DNS

## 使用 Cloudflare D1（可选）

D1 �?CF 原生 SQLite 数据库，�?Workers 延迟最低（同区�?< 1ms）：

```bash
# 创建 D1 数据�?wrangler d1 create zhong-pay

# �?wrangler.toml 中启用（取消注释�?[[d1_databases]]
binding = "DB"
database_name = "zhong-pay"
database_id = "your-d1-database-id"

# 运行迁移�?D1
wrangler d1 execute zhong-pay --file=packages/server/prisma/migrations/*/migration.sql
```

> ⚠️ D1 目前�?Beta 版，不建议用于大规模生产环境�?
## 查看 Worker 日志

```bash
# 实时日志
wrangler tail

# 过滤错误
wrangler tail --status error
```

## 常见问题

**Worker 提示 "Workers KV is not enabled"**

�?CF 控制�?�?Workers & Pages �?KV，创建命名空间后重新配置 `wrangler.toml`�?
**数据库连接超�?*

CF Workers 仅支�?HTTP/WebSocket 协议连接数据库，确保使用 PlanetScale �?HTTP 驱动�?Neon �?WebSocket 驱动�?
**CORS 错误**

确认 Worker �?`ALLOWED_ORIGINS` Secret 包含前端域名�?
---

> 遇到问题？[提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=bug_report.md) 或查�?[FAQ](faq.md)
