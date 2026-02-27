# Docker 部署文档

> **维护**：[AME](https://github.com/AME-CoLtd) · 版权归属 AME，基�?Apache 2.0 开�?
## 概述

Docker 部署方式适合拥有 VPS / 云服务器的用户，提供完全自主可控的环境，包含�?
- **MySQL 8.0**：数据存�?- **Node.js API 服务**：后端业务逻辑
- **Nginx**：反向代�?+ 静态文件服�?- **自动数据库迁�?*

## 环境要求

| 软件 | 最低版�?|
|------|----------|
| Docker | 24.x+ |
| Docker Compose | 2.x+ |
| 服务器内�?| �?1 GB |
| 服务器磁�?| �?10 GB |

## 快速部�?
### 方式一：一键脚本（推荐�?
```bash
# 克隆仓库
git clone https://github.com/AME-CoLtd/Zhong-Pay.git
cd zhong-pay

# 运行一键部署脚本（会引导你完成配置�?bash scripts/deploy-docker.sh
```

脚本会自动完成：
1. 检�?Docker 环境
2. 初始�?`.env` 配置文件
3. 构建前端静态资�?4. 启动全部容器
5. 等待数据库就绪并执行迁移
6. 初始化种子数据（首次�?
### 方式二：手动部署

**步骤 1：配置环境变�?*

```bash
cp .env.example .env
vim .env
```

必须修改的配置项�?
```bash
# 数据库密码（请修改为强密码）
MYSQL_ROOT_PASSWORD=your_strong_root_password
MYSQL_PASSWORD=your_strong_db_password

# JWT 密钥（必须修改！�?# 生成命令: openssl rand -hex 32
JWT_SECRET=your_random_64_char_secret

# 你的域名（用�?CORS 和支付回调）
ALLOWED_ORIGINS=https://yourdomain.com
ALIPAY_NOTIFY_URL=https://yourdomain.com/api/notify/alipay
WECHAT_NOTIFY_URL=https://yourdomain.com/api/notify/wechat
```

**步骤 2：构建前�?*

```bash
cd packages/admin
npm install
VITE_API_URL="" npm run build   # 同域部署留空
cd ../..
```

**步骤 3：启动服�?*

```bash
docker-compose up -d
```

**步骤 4：初始化数据�?*

```bash
# 等待数据库就绪（�?30 秒）
docker-compose exec server sh -c "npx prisma migrate deploy"
docker-compose exec server sh -c "npx ts-node prisma/seed.ts"
```

## 验证部署

```bash
# 查看容器状�?docker-compose ps

# 健康检�?curl http://localhost/health

# 查看服务日志
docker-compose logs -f server
docker-compose logs -f nginx
```

访问 `http://your-server-ip` 即可看到管理后台登录页�?
## 配置 HTTPS（强烈推荐）

**方式一：Let's Encrypt（免费）**

```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx

# 申请证书（先确保域名已解析到服务器）
certbot --nginx -d yourdomain.com

# 证书路径
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

将证书复制到项目目录，然后修�?`docker/nginx/conf.d/default.conf`，取消注�?SSL 相关配置�?
**方式二：使用 Cloudflare CDN 代理（最简单）**

1. 域名托管�?Cloudflare
2. 开�?"代理" 模式（橙色云朵）
3. SSL/TLS 设置�?"灵活" �?"完全"

## 更新部署

```bash
# 拉取最新代�?git pull origin main

# 重新构建并启�?docker-compose up -d --build

# 运行数据库迁移（如有�?docker-compose exec server sh -c "npx prisma migrate deploy"
```

## 常用运维命令

```bash
# 停止服务
docker-compose down

# 停止并删除数据（⚠️ 危险�?docker-compose down -v

# 查看实时日志
docker-compose logs -f

# 进入容器调试
docker-compose exec server sh
docker-compose exec mysql mysql -uroot -p

# 备份数据�?docker-compose exec mysql mysqldump -uroot -p zhong_pay > backup.sql

# 恢复数据�?docker-compose exec -T mysql mysql -uroot -p zhong_pay < backup.sql
```

## 故障排查

**问题：数据库连接失败**

```bash
# 检�?MySQL 状�?docker-compose logs mysql
# 确认环境变量中数据库密码�?MYSQL_PASSWORD 一�?```

**问题：前�?API 请求 404**

```bash
# 检�?Nginx 配置
docker-compose exec nginx nginx -t
# 确认前端已正确构建到 packages/admin/dist/
ls packages/admin/dist/
```

**问题：支付回调不触发**

- 确认 `ALIPAY_NOTIFY_URL` / `WECHAT_NOTIFY_URL` 填写了公网可访问地址
- 确认服务器防火墙开放了 80/443 端口
- 查看回调日志：`docker-compose logs server | grep notify`

---

> 遇到问题？[提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=bug_report.md) 或查�?[FAQ](faq.md)
