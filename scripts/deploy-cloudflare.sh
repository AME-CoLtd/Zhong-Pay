#!/usr/bin/env bash
# =============================================================
# 众支付 - Cloudflare 一键部署脚本
# 需要: Node.js, Wrangler CLI (npm i -g wrangler)
# 使用: bash scripts/deploy-cloudflare.sh
# =============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo -e "${CYAN}=================================================${NC}"
echo -e "${CYAN}       众支付 Cloudflare 一键部署脚本           ${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""

# ---- 检查依赖 ----
command -v node     >/dev/null 2>&1 || error "请先安装 Node.js"
command -v wrangler >/dev/null 2>&1 || { warn "正在安装 Wrangler..."; npm i -g wrangler; }
success "Wrangler: $(wrangler --version)"

# ---- 登录 Cloudflare ----
info "检查 Cloudflare 登录状态..."
wrangler whoami >/dev/null 2>&1 || {
  info "请登录 Cloudflare..."
  wrangler login
}
success "已登录 Cloudflare"

# ---- 收集配置 ----
echo ""
echo -e "${YELLOW}请填写以下配置：${NC}"
echo ""

read -rp "数据库连接字符串 DATABASE_URL (推荐 PlanetScale/Neon): " DB_URL
[[ -z "$DB_URL" ]] && error "DATABASE_URL 不能为空"

read -rp "JWT Secret (回车自动生成): " JWT_SECRET
[[ -z "$JWT_SECRET" ]] && JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

read -rp "KV Namespace ID (从 CF 控制台创建后填写，留空跳过): " KV_ID

# ---- 安装 Worker 依赖 ----
info "安装 Worker 依赖..."
cd "$PROJECT_DIR/packages/worker"
npm ci --silent

# ---- 更新 wrangler.toml 中的 KV ID ----
if [[ -n "$KV_ID" ]]; then
  sed -i "s|your-kv-namespace-id|$KV_ID|g" wrangler.toml
  success "KV Namespace 配置完成"
fi

# ---- 设置 Worker Secrets ----
info "配置 Worker 环境变量（Secrets）..."
echo "$DB_URL"     | wrangler secret put DATABASE_URL
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET

# 可选的支付配置
read -rp "是否现在配置支付宝/微信支付密钥？[y/N] " config_pay
if [[ "${config_pay,,}" == "y" ]]; then
  read -rp "ALIPAY_APP_ID: " V; [[ -n "$V" ]] && echo "$V" | wrangler secret put ALIPAY_APP_ID
  read -rp "ALIPAY_PRIVATE_KEY: " V; [[ -n "$V" ]] && echo "$V" | wrangler secret put ALIPAY_PRIVATE_KEY
  read -rp "ALIPAY_PUBLIC_KEY: " V; [[ -n "$V" ]] && echo "$V" | wrangler secret put ALIPAY_PUBLIC_KEY
  read -rp "WECHAT_APP_ID: " V; [[ -n "$V" ]] && echo "$V" | wrangler secret put WECHAT_APP_ID
  read -rp "WECHAT_MCH_ID: " V; [[ -n "$V" ]] && echo "$V" | wrangler secret put WECHAT_MCH_ID
  read -rp "WECHAT_API_KEY: " V; [[ -n "$V" ]] && echo "$V" | wrangler secret put WECHAT_API_KEY
fi

# ---- 部署 Worker ----
info "部署 Cloudflare Worker..."
WORKER_URL=$(wrangler deploy --env production 2>&1 | grep -oP 'https://[^\s]+workers\.dev' | head -1)
[[ -z "$WORKER_URL" ]] && {
  warn "无法自动获取 Worker URL，请从控制台查看"
  WORKER_URL="https://zhong-pay-worker.your-account.workers.dev"
}
success "Worker 部署成功: $WORKER_URL"

# 更新回调地址
echo "$WORKER_URL/api/notify/alipay" | wrangler secret put ALIPAY_NOTIFY_URL
echo "$WORKER_URL/api/notify/wechat" | wrangler secret put WECHAT_NOTIFY_URL

# ---- 运行数据库迁移 ----
info "运行数据库迁移..."
cd "$PROJECT_DIR/packages/server"
npm ci --silent 2>/dev/null || true
npx prisma generate
DATABASE_URL="$DB_URL" npx prisma migrate deploy && success "数据库迁移完成"

# ---- 创建 CF Pages 项目并部署前端 ----
info "构建并部署前端到 Cloudflare Pages..."
cd "$PROJECT_DIR/packages/admin"
npm ci --silent
VITE_API_URL="$WORKER_URL" npm run build

# 部署到 CF Pages
wrangler pages deploy dist \
  --project-name=zhong-pay-admin \
  --branch=main \
  --commit-dirty=true 2>/dev/null && success "前端部署到 CF Pages 完成" || {
    warn "CF Pages 项目可能不存在，正在尝试创建..."
    wrangler pages project create zhong-pay-admin --production-branch=main
    wrangler pages deploy dist --project-name=zhong-pay-admin --branch=main
  }

PAGES_URL="https://zhong-pay-admin.pages.dev"

# ---- 完成 ----
echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}        🎉 Cloudflare 部署完成！               ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "  🌐 管理后台:  ${CYAN}$PAGES_URL${NC}"
echo -e "  🔌 Worker API: ${CYAN}$WORKER_URL${NC}"
echo ""
echo -e "  👤 默认账号: ${YELLOW}admin${NC}"
echo -e "  🔑 默认密码: ${YELLOW}Admin@123456${NC}  ← 登录后请立即修改！"
echo ""
echo -e "  💡 初始化种子数据："
echo -e "     ${CYAN}cd packages/server && DATABASE_URL=\"$DB_URL\" npx ts-node prisma/seed.ts${NC}"
echo ""
echo -e "  🌍 自定义域名："
echo -e "     Worker: wrangler deploy --route 'api.yourdomain.com/*'"
echo -e "     Pages:  在 CF Pages 控制台 → Custom domains 添加"
echo ""
