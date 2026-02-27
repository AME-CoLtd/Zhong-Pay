# CI/CD 自动化部署文�?
> **维护**：[AME](https://github.com/AME-CoLtd) · 版权归属 AME，基�?Apache 2.0 开�?
## 概述

众支付内�?4 �?GitHub Actions Workflow，实现代码推送自动部署：

| Workflow 文件 | 触发条件 | 功能 |
|---------------|----------|------|
| `ci.yml` | PR / push 任意分支 | 代码检�?+ 构建验证 |
| `deploy-docker.yml` | push main | 构建镜像 �?SSH 推送服务器 |
| `deploy-vercel.yml` | push main | 自动部署 Vercel |
| `deploy-cloudflare.yml` | push main | 自动部署 CF Workers + Pages |

---

## 通用配置

### 1. Fork 仓库后启�?Actions

在你�?Fork 仓库 �?Settings �?Actions �?General �?选择 "Allow all actions"

### 2. 配置 GitHub Secrets

进入 **仓库 Settings �?Secrets and variables �?Actions �?New repository secret**

---

## CI（代码检查）

`ci.yml` 在每�?PR �?push 时自动运行，无需额外配置，自动完成：

- 安装依赖
- 生成 Prisma Client
- TypeScript 构建验证
- 上传前端构建产物

---

## Docker 服务器部�?
### 必须配置�?Secrets

| Secret 名称 | 说明 |
|-------------|------|
| `SERVER_HOST` | 服务�?IP 或域�?|
| `SERVER_USER` | SSH 登录用户名（�?`ubuntu`）|
| `SERVER_SSH_KEY` | SSH 私钥内容（`cat ~/.ssh/id_rsa`）|
| `SERVER_PORT` | SSH 端口（默�?`22`）|
| `JWT_SECRET` | JWT 签名密钥 |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 |
| `MYSQL_USER` | MySQL 用户�?|
| `MYSQL_PASSWORD` | MySQL 密码 |
| `ALLOWED_ORIGINS` | 允许跨域来源 |
| `VITE_API_URL` | 前端调用�?API 地址（留空则同域）|
| `ALIPAY_APP_ID` | 支付�?App ID |
| `ALIPAY_PRIVATE_KEY` | 支付宝私�?|
| `ALIPAY_PUBLIC_KEY` | 支付宝公�?|
| `ALIPAY_NOTIFY_URL` | 支付宝回调地址 |
| `WECHAT_APP_ID` | 微信 AppID |
| `WECHAT_MCH_ID` | 微信商户�?|
| `WECHAT_API_KEY` | 微信 API 密钥 |
| `WECHAT_NOTIFY_URL` | 微信回调地址 |

### 生成 SSH 密钥�?
```bash
# 在本地生成密钥对
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy

# 将公钥添加到服务�?ssh-copy-id -i ~/.ssh/github_deploy.pub user@your-server

# 将私钥内容添加到 GitHub Secrets（SERVER_SSH_KEY�?cat ~/.ssh/github_deploy
```

### 服务器初始化（首次）

```bash
# 在服务器上安�?Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 创建部署目录
mkdir -p /opt/zhongpay
```

---

## Vercel 自动部署

### 必须配置�?Secrets

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|----------|
| `VERCEL_TOKEN` | Vercel API Token | Vercel 控制�?�?Settings �?Tokens |
| `VERCEL_ORG_ID` | 组织 ID | 运行 `vercel link` 后查�?`.vercel/project.json` |
| `VERCEL_PROJECT_ID_API` | 后端项目 ID | 同上 |
| `VERCEL_PROJECT_ID_ADMIN` | 前端项目 ID | 同上 |
| `VITE_API_URL` | 后端部署 URL | Vercel 控制台查�?|

### 获取项目 ID

```bash
cd packages/server
vercel link
cat .vercel/project.json
# {"orgId":"xxx","projectId":"yyy"}
```

---

## Cloudflare 自动部署

### 必须配置�?Secrets

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|----------|
| `CF_API_TOKEN` | CF API Token | CF 控制�?�?My Profile �?API Tokens |
| `CF_ACCOUNT_ID` | CF 账户 ID | CF 控制台右侧边�?|
| `CF_WORKER_URL` | Worker 部署后的 URL | 首次手动部署后获�?|

### 创建 CF API Token

1. 进入 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 选择模板 **"Edit Cloudflare Workers"**
4. 权限添加：`Cloudflare Pages:Edit`
5. 创建并复�?Token

---

## 手动触发部署

所�?Deploy Workflow 都支持手动触发：

1. 进入 **仓库 �?Actions**
2. 选择对应 Workflow
3. 点击 **"Run workflow"** �?选择分支 �?**"Run workflow"**

---

## 部署通知（可选）

可在 Workflow 中添加钉�?/ 飞书 / Slack 通知�?
```yaml
- name: 钉钉通知
  if: always()
  uses: zcong1993/actions-ding@master
  with:
    dingToken: ${{ secrets.DING_TOKEN }}
    body: |
      {
        "msgtype": "text",
        "text": {
          "content": "众支付部�?{{ job.status == 'success' && '成功 �? || '失败 �? }}"
        }
      }
```

---

> 遇到问题？[提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=bug_report.md)
