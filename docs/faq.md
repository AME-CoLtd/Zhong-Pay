# 常见问题 FAQ

> **维护**：[AME](https://github.com/AME-CoLtd) · 如果你的问题不在列表中，�?[提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=question.md)

## 目录

- [安装 & 启动问题](#安装--启动问题)
- [数据库问题](#数据库问�?
- [支付配置问题](#支付配置问题)
- [部署问题](#部署问题)
- [功能使用问题](#功能使用问题)

---

## 安装 & 启动问题

**Q: `npm run install:all` 报错**

```
Error: ERESOLVE unable to resolve dependency tree
```

A: 尝试使用 legacy 模式�?
```bash
npm install --legacy-peer-deps
```

---

**Q: 启动后访�?http://localhost:5173 显示白屏**

A: 检查以下几点：
1. 确认后端服务已启动：`curl http://localhost:3000/health`
2. 查看浏览器控制台报错信息
3. 确认 `packages/admin/.env` �?`VITE_API_URL` 配置正确（本地开发留空即可）

---

**Q: ts-node-dev 报错找不到模�?*

A: 需要先生成 Prisma Client�?
```bash
cd packages/server
npx prisma generate
```

---

## 数据库问�?
**Q: `prisma migrate dev` 报错 "P1001: Can't reach database server"**

A: 确认 MySQL 已启动，�?`.env` �?`DATABASE_URL` 格式正确�?
```bash
# 测试数据库连�?mysql -h 127.0.0.1 -u root -p

# 正确�?DATABASE_URL 格式
DATABASE_URL="mysql://username:password@host:port/database_name"
```

---

**Q: 数据库迁移报�?"P3014: Prisma Migrate could not create the shadow database"**

A: shadow database 需要权限创建临时数据库，给用户授权�?
```sql
GRANT ALL PRIVILEGES ON *.* TO 'username'@'%';
FLUSH PRIVILEGES;
```

或使�?`npx prisma migrate deploy`（不需�?shadow database）�?
---

**Q: 使用云数据库（PlanetScale）迁移失�?*

A: PlanetScale 不支持外键约束，需修改 `schema.prisma`�?
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["referentialIntegrity"]
}

datasource db {
  provider             = "mysql"
  url                  = env("DATABASE_URL")
  referentialIntegrity = "prisma"
}
```

---

## 支付配置问题

**Q: 支付宝下单报�?"INVALID_APP_AUTH_TOKEN"**

A: 检查：
1. `ALIPAY_APP_ID` 是否正确
2. `ALIPAY_PRIVATE_KEY` 是否�?PKCS8 格式（开放平台要求）
3. 是否开启了对应支付产品（如"电脑网站支付"�?
---

**Q: 支付宝沙箱环境如何配�?*

A: 修改 `ALIPAY_GATEWAY`�?
```bash
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

使用沙箱�?App ID、私钥和支付宝公钥�?
---

**Q: 微信支付回调签名验证失败**

A: 常见原因�?1. `WECHAT_API_KEY` 与商户平台设置的 API 密钥不一�?2. 参数排序不正确（需严格�?ASCII 升序�?3. 回调 URL 不是公网可访问地址

---

**Q: 本地开发如何测试支付回�?*

A: 使用内网穿透工具：

```bash
# 方式1: ngrok
ngrok http 3000
# 获得临时域名: https://xxxx.ngrok.io

# 方式2: Cloudflare Tunnel（永久免费）
cloudflared tunnel --url http://localhost:3000
```

将获得的公网地址填入 `ALIPAY_NOTIFY_URL` / `WECHAT_NOTIFY_URL`�?
---

## 部署问题

**Q: Docker 部署后管理后台显�?"API 请求失败"**

A: 检�?Nginx 配置中的 API 代理�?
```bash
# 查看 Nginx 日志
docker-compose logs nginx

# 测试 API 是否正常
docker-compose exec nginx curl http://server:3000/health
```

---

**Q: Vercel 部署�?API 请求跨域报错**

A: �?Vercel 后端项目的环境变量中设置�?
```
ALLOWED_ORIGINS=https://your-admin-project.vercel.app
```

---

**Q: Cloudflare Worker 部署报错 "Error: Script startup exceeded CPU time limit"**

A: Worker 免费版有 CPU 时间限制�?0ms/request），建议�?1. 减少 Worker 中的同步计算
2. 升级�?Cloudflare Workers Paid�?5/月）

---

**Q: GitHub Actions 部署失败，SSH 连接超时**

A: 检查：
1. `SERVER_HOST` 是否为公�?IP
2. 服务器安全组/防火墙是否开�?SSH 端口�?2 或自定义端口�?3. `SERVER_SSH_KEY` 是否完整包含 `-----BEGIN...-----` �?`-----END...-----`

---

## 功能使用问题

**Q: 登录提示 "用户名或密码错误" 但输入正�?*

A: 数据库种子数据可能未初始化，运行�?
```bash
cd packages/server
npx ts-node prisma/seed.ts
# �?Docker 环境:
docker-compose exec server sh -c "npx ts-node prisma/seed.ts"
```

默认账号：`admin` / `Admin@123456`

---

**Q: 商户无法下单，提�?"商户不存在或已禁�?**

A: 检查：
1. 使用�?`apiKey` 是否正确（在商户管理页面查看�?2. 商户状态是否为 "正常"（ACTIVE�?3. 签名计算是否正确（参�?[API 文档](api.md#签名规则)�?
---

**Q: 如何修改管理员密�?*

A: 登录后进入右上角用户菜单 �?修改密码�?
或直接通过 API�?
```bash
curl -X PUT http://localhost:3000/api/auth/password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"Admin@123456","newPassword":"YourNewPassword"}'
```

---

**Q: 数据统计图表不显示数�?*

A: 确认�?1. 系统中有已支付订单（`status = PAID`�?2. 图表时间范围内有数据（默认显示近 7 天）

---

> 仍未解决？请 [提交 Issue](https://github.com/AME-CoLtd/Zhong-Pay/issues/new?template=question.md) 并附上详细错误信息�?> 
> **AME** 会尽快回复！
