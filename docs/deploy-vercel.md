# Vercel 部署文档

> **维护**：[AME](https://github.com/AME-CoLtd) · 版权归属 AME，基�?Apache 2.0 开�?
## 概述

Vercel 部署方案将系统拆分为两个项目�?
| 项目 | 内容 | Vercel 类型 |
|------|------|-------------|
| `zhong-pay-api` | 后端 Express API | Serverless Functions |
| `zhong-pay-admin` | 前端管理后台 | Static Pages |

数据库推荐使用云数据库（Vercel Serverless 不支�?TCP 长连接的传统 MySQL）：

| 推荐数据�?| 协议 | 免费额度 |
|-----------|------|----------|
| [PlanetScale](https://planetscale.com) | MySQL 兼容 | 5 GB 存储 |
| [Neon](https://neon.tech) | PostgreSQL | 0.5 GB 存储 |
| [Supabase](https://supabase.com) | PostgreSQL | 500 MB 存储 |

> ⚠️ **注意**：使�?PostgreSQL 数据库时，需�?`prisma/schema.prisma` 中的 `provider` 改为 `postgresql`�?
## 准备工作

1. 注册 [Vercel 账号](https://vercel.com/signup)
2. 注册并创建云数据库（�?PlanetScale 为例�?3. 安装 Vercel CLI：`npm i -g vercel`

## 快速部署（一键脚本）

```bash
bash scripts/deploy-vercel.sh
```

按照提示输入数据库连接字符串等配置，脚本自动完成部署�?
## 手动部署

### 第一步：创建数据�?
�?**PlanetScale** 为例�?
```bash
# 安装 PlanetScale CLI
brew install planetscale/tap/pscale

# 登录
pscale auth login

# 创建数据�?pscale database create zhong-pay --region ap-northeast

# 获取连接字符串（�?PlanetScale 控制�?Connect 页面获取�?# 格式: mysql://user:pass@host/zhong-pay?sslaccept=strict
```

### 第二步：运行数据库迁�?
```bash
cd packages/server
npm install

# 使用云数据库 URL
DATABASE_URL="mysql://..." npx prisma migrate deploy
DATABASE_URL="mysql://..." npx ts-node prisma/seed.ts
```

### 第三步：部署后端 API

```bash
cd packages/server

# 关联�?Vercel 项目
vercel link

# 配置环境变量
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production
vercel env add NODE_ENV production  # �? production
vercel env add ALLOWED_ORIGINS production  # �? https://your-admin.vercel.app

# 部署
vercel deploy --prod
# 记录输出�?API URL，如: https://zhong-pay-api.vercel.app
```

### 第四步：部署前端管理后台

```bash
cd packages/admin

vercel link

# 配置前端环境变量
vercel env add VITE_API_URL production
# �? 上一步的 API URL，如 https://zhong-pay-api.vercel.app

vercel deploy --prod
```

## 配置 Vercel 环境变量

�?Vercel 控制台（Settings �?Environment Variables）配置：

### 后端（zhong-pay-api�?
| 变量�?| 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | 数据库连接字符串 | `mysql://user:pass@host/db` |
| `JWT_SECRET` | JWT 签名密钥 | 32+ 位随机字符串 |
| `NODE_ENV` | 运行环境 | `production` |
| `ALLOWED_ORIGINS` | 允许的前端域�?| `https://xxx.vercel.app` |
| `ALIPAY_APP_ID` | 支付宝应�?ID | |
| `ALIPAY_PRIVATE_KEY` | 支付宝应用私�?| |
| `ALIPAY_PUBLIC_KEY` | 支付宝公�?| |
| `WECHAT_APP_ID` | 微信 AppID | |
| `WECHAT_MCH_ID` | 微信商户�?| |
| `WECHAT_API_KEY` | 微信 API 密钥 | |

### 前端（zhong-pay-admin�?
| 变量�?| 说明 | 示例 |
|--------|------|------|
| `VITE_API_URL` | 后端 API 地址 | `https://zhong-pay-api.vercel.app` |

## 配置自定义域�?
1. Vercel 控制�?�?项目 �?Settings �?Domains
2. 添加自定义域�?3. 按提示配�?DNS 记录

配置完成后，更新 `ALLOWED_ORIGINS` 和支付回调地址�?
```
ALIPAY_NOTIFY_URL=https://api.yourdomain.com/api/notify/alipay
WECHAT_NOTIFY_URL=https://api.yourdomain.com/api/notify/wechat
```

## 注意事项

- **Serverless 冷启�?*：首次请求可能有 1-3 秒延迟，可通过 Vercel Pro �?Always On"解决
- **函数执行时间**：免费版最�?10 秒，付费版最�?60 �?- **并发限制**：免费版有并发请求限制，生产环境建议使用 Pro �?- **数据库连�?*：每�?Serverless 实例会创建独立连接，建议数据库配置连接池

---

> 遇到问题？[提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=bug_report.md) 或查�?[FAQ](faq.md)
