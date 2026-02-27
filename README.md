<div align="center">

<img src="https://img.shields.io/badge/众支付-ZhongPay-1677ff?style=for-the-badge&logo=alipay&logoColor=white" alt="众支付" />

# 众支付 · ZhongPay

**开源聚合支付系统 | 支持支付宝 · 微信支付 · 多平台一键部署**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)
[![GitHub Issues](https://img.shields.io/github/issues/AME-CoLtd/Zhong-Pay?style=flat-square)](https://github.com/AME-CoLtd/Zhong-Pay/issues)

[快速开始](#-快速开始) · [部署文档](#-部署方式) · [API 文档](docs/api.md) · [提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new/choose) · [贡献代码](CONTRIBUTING.md)

</div>

---

## ✨ 项目简介

**众支付（ZhongPay）** 是一款由 **AME & Entertainment** 开发并开源维护的聚合支付系统，提供统一的支付下单、回调处理、商户管理和数据统计能力。支持多种主流支付渠道，可一键部署到 Docker 服务器、Vercel 或 Cloudflare 等平台。

> 📢 **版权声明**：本项目技术维护及版权归属 **AME & Entertainment**，基于 Apache 2.0 协议开源，允许商业使用，但须保留版权声明。

---

## 🎯 核心功能

| 模块 | 功能描述 |
|------|----------|
| 💳 **聚合支付** | 支付宝（PC网站 / H5 / 扫码）、微信支付（Native / H5）统一下单 |
| 📦 **订单管理** | 订单查询、状态跟踪、支付详情、手动关闭 |
| 🏪 **商户管理** | 多商户隔离、API 密钥管理、余额与费率配置 |
| 💰 **提现管理** | 提现申请审核、打款确认、资金流水 |
| 📊 **数据统计** | 实时收款看板、趋势图表、渠道分布 |
| ⚙️ **系统配置** | 费率、限额、回调等参数在线管理 |
| 🔐 **权限控制** | JWT 认证、角色权限（超管 / 管理员 / 员工） |
| 🔔 **异步回调** | 支付成功后自动通知商户，支持重试机制 |

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────┐
│                   前端管理后台                    │
│     React 18 + TypeScript + Ant Design 5         │
│        Zustand 状态管理 | Vite 5 构建             │
└──────────────────┬──────────────────────────────┘
                   │ HTTP / REST API
┌──────────────────▼──────────────────────────────┐
│                  后端 API 服务                    │
│   Node.js 20 + Express 4 + TypeScript           │
│   Prisma ORM | JWT Auth | Winston 日志           │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │      MySQL 8.0       │
        │    (Prisma 管理)     │
        └─────────────────────┘
```

**支付渠道集成：**
- 🔵 **支付宝**：alipay-sdk，支持 RSA2 签名
- 🟢 **微信支付**：原生 API，支持 V2/V3

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本要求 |
|------|----------|
| Node.js | ≥ 20.x |
| MySQL | ≥ 8.0（或 PlanetScale / Neon 云数据库）|
| npm | ≥ 9.x |

### 本地开发

```bash
# 1. 克隆仓库
git clone https://github.com/AME-CoLtd/Zhong-Pay.git
cd zhong-pay

# 2. 安装所有依赖
npm run install:all

# 3. 配置后端环境变量
cp packages/server/.env.example packages/server/.env
# 编辑 .env 填写数据库连接和支付配置

# 4. 初始化数据库
npm run db:migrate
npm run db:seed

# 5. 启动开发服务
npm run dev
# 后端: http://localhost:3000
# 前端: http://localhost:5173
```

**默认管理员账号：** `admin` / `Admin@123456`（首次登录后请立即修改密码）

---

## 📦 部署方式

众支付支持三种一键部署方案，选择最适合你的方式：

### 🐳 方式一：Docker（推荐自建服务器）

适合有 VPS / 云服务器的用户，完全自主控制。

```bash
# 1. 复制并配置环境变量
cp .env.example .env
vim .env   # 修改数据库密码、JWT Secret 及支付配置

# 2. 一键部署
bash scripts/deploy-docker.sh
# 或: npm run deploy:docker
```

详见 → [Docker 部署文档](docs/deploy-docker.md)

---

### ▲ 方式二：Vercel（推荐无服务器）

前端部署到 Vercel Pages，后端部署为 Serverless Functions，数据库使用 [PlanetScale](https://planetscale.com) 或 [Neon](https://neon.tech)（均有免费额度）。

```bash
# 需要安装 Vercel CLI
npm i -g vercel

# 一键部署
bash scripts/deploy-vercel.sh
# 或: npm run deploy:vercel
```

详见 → [Vercel 部署文档](docs/deploy-vercel.md)

---

### ☁️ 方式三：Cloudflare（推荐全球加速）

前端部署到 Cloudflare Pages，后端运行于 Cloudflare Workers 边缘网络，全球低延迟。

```bash
# 需要安装 Wrangler CLI
npm i -g wrangler

# 一键部署
bash scripts/deploy-cloudflare.sh
# 或: npm run deploy:cloudflare
```

详见 → [Cloudflare 部署文档](docs/deploy-cloudflare.md)

---

### ⚡ 方式四：GitHub Actions 自动化部署

推送代码到 `main` 分支自动触发 CI/CD：

| Workflow | 触发条件 | 说明 |
|----------|----------|------|
| `ci.yml` | PR / push | 代码检查 + 构建验证 |
| `deploy-docker.yml` | push main | SSH 推送服务器部署 |
| `deploy-vercel.yml` | push main | 自动部署 Vercel |
| `deploy-cloudflare.yml` | push main | 自动部署 CF Workers + Pages |

详见 → [CI/CD 配置文档](docs/cicd.md)

---

## 📁 项目结构

```
zhong-pay/
├── packages/
│   ├── server/               # 后端 Express API
│   │   ├── src/
│   │   │   ├── routes/       # 路由：auth/pay/order/merchant...
│   │   │   ├── services/     # 支付宝/微信支付服务
│   │   │   ├── middlewares/  # JWT 认证、错误处理
│   │   │   ├── utils/        # 工具：日志/Prisma/助手函数
│   │   │   └── adapter/      # Vercel Serverless 适配器
│   │   └── prisma/           # 数据模型 + 迁移 + 种子数据
│   │
│   ├── admin/                # 前端管理后台 (React)
│   │   └── src/
│   │       ├── pages/        # 页面：登录/看板/订单/商户...
│   │       ├── layouts/      # 布局组件
│   │       ├── store/        # Zustand 状态管理
│   │       └── utils/        # Axios 封装
│   │
│   └── worker/               # Cloudflare Worker (Hono)
│       └── src/
│           ├── routes/       # 同 server，适配 CF 边缘运行时
│           ├── middlewares/  # 限流/JWT（Web Crypto API）
│           └── utils/        # DB/加密工具
│
├── docker/
│   ├── nginx/                # Nginx 反向代理配置
│   └── mysql/                # MySQL 初始化脚本
│
├── scripts/                  # 一键部署脚本
│   ├── deploy-docker.sh
│   ├── deploy-vercel.sh
│   └── deploy-cloudflare.sh
│
├── .github/workflows/        # GitHub Actions CI/CD
├── docs/                     # 完整文档
└── docker-compose.yml
```

---

## 🔌 API 接口概览

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/login` | 管理员登录 | ❌ |
| GET | `/api/auth/me` | 获取当前用户 | ✅ |
| POST | `/api/pay/unified` | 统一支付下单 | 签名 |
| GET | `/api/pay/query` | 查询订单状态 | 签名 |
| POST | `/api/notify/alipay` | 支付宝回调 | 平台签名 |
| POST | `/api/notify/wechat` | 微信支付回调 | 平台签名 |
| GET | `/api/orders` | 订单列表 | ✅ |
| GET | `/api/merchants` | 商户列表 | ✅ |
| GET | `/api/stats/overview` | 数据总览 | ✅ |
| GET | `/health` | 健康检查 | ❌ |

完整 API 文档 → [docs/api.md](docs/api.md)

---

## 🐛 问题反馈

遇到 Bug 或有功能建议？欢迎通过以下方式反馈：

- 🐛 **Bug 报告** → [提交 Bug Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=bug_report.yml)
- 💡 **功能建议** → [提交 Feature Request](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=feature_request.yml)
- 🔒 **安全漏洞** → [提交安全 Issue（Private）](https://github.com/AME-CoLtd/Zhong-Pay/security/advisories/new)
- 💬 **使用讨论** → [GitHub Discussions](https://github.com/AME-CoLtd/Zhong-Pay/discussions)

提交 Issue 前请先查阅 [常见问题 FAQ](docs/faq.md)。

---

## 🤝 参与贡献

我们欢迎所有形式的贡献！请阅读 [贡献指南](CONTRIBUTING.md) 了解参与方式。

[![Contributors](https://contrib.rocks/image?repo=AME-CoLtd/Zhong-Pay)](https://github.com/AME-CoLtd/Zhong-Pay/graphs/contributors)

---

## 📄 开源协议

本项目基于 [Apache License 2.0](LICENSE) 开源。

```
Copyright (c) 2026 AME & Entertainment

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
```

> ⚠️ **使用须知**：允许商业使用、修改和分发，但须保留原始版权声明及 AME & Entertainment 署名信息，不得用于侵权或违法业务。

---

<div align="center">

**Powered by AME & Entertainment ❤️**

[官网](https://www.amemusic.cn) · [GitHub](https://github.com/AME-CoLtd) · [问题反馈](https://github.com/AME-CoLtd/Zhong-Pay/issues)

</div>
