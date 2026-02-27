#!/usr/bin/env bash
# =============================================================
# 众支付 - Vercel 一键部署脚本
# 需要: Node.js, Vercel CLI (npm i -g vercel)
# 使用: bash scripts/deploy-vercel.sh
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
echo -e "${CYAN}         众支付 Vercel 一键部署脚本             ${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""

# ---- 检查依赖 ----
command -v node   >/dev/null 2>&1 || error "请先安装 Node.js: https://nodejs.org"
command -v vercel >/dev/null 2>&1 || { warn "正在安装 Vercel CLI..."; npm i -g vercel; }
success "Vercel CLI: $(vercel --version)"

# ---- 登录 Vercel ----
info "检查 Vercel 登录状态..."
vercel whoami >/dev/null 2>&1 || {
  info "请登录 Vercel..."
  vercel login
}
success "已登录 Vercel: $(vercel whoami)"

# ---- 收集配置 ----
echo ""
echo -e "${YELLOW}请填写以下配置（回车使用默认值）：${NC}"
echo ""

read -rp "数据库连接字符串 DATABASE_URL (mysql://...): " DB_URL
[[ -z "$DB_URL" ]] && error "DATABASE_URL 不能为空，请使用 PlanetScale/Neon 等云数据库"

read -rp "JWT Secret (回车自动生成): " JWT_SECRET
[[ -z "$JWT_SECRET" ]] && JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
success "JWT_SECRET: ${JWT_SECRET:0:8}..."

read -rp "允许跨域来源 (留空则默认 *): " ALLOWED_ORIGINS
ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-*}"

# ---- 部署后端 API ----
echo ""
info "部署后端 API 到 Vercel..."
cd "$PROJECT_DIR/packages/server"
npm ci --silent
npx prisma generate

# 设置 Vercel 环境变量
vercel env add DATABASE_URL production <<< "$DB_URL" 2>/dev/null || true
vercel env add JWT_SECRET production <<< "$JWT_SECRET" 2>/dev/null || true
vercel env add ALLOWED_ORIGINS production <<< "$ALLOWED_ORIGINS" 2>/dev/null || true
vercel env add NODE_ENV production <<< "production" 2>/dev/null || true

API_URL=$(vercel deploy --prod --yes 2>&1 | grep -oP 'https://[^\s]+' | tail -1)
[[ -z "$API_URL" ]] && error "后端部署失败"
success "后端 API 部署成功: $API_URL"

# ---- 运行数据库迁移 ----
info "运行数据库迁移..."
DATABASE_URL="$DB_URL" npx prisma migrate deploy && success "数据库迁移完成"

# ---- 部署前端 Admin ----
echo ""
info "部署前端管理后台到 Vercel..."
cd "$PROJECT_DIR/packages/admin"
npm ci --silent

# 设置前端环境变量
vercel env add VITE_API_URL production <<< "$API_URL" 2>/dev/null || true

ADMIN_URL=$(vercel deploy --prod --yes --build-env VITE_API_URL="$API_URL" 2>&1 | grep -oP 'https://[^\s]+' | tail -1)
[[ -z "$ADMIN_URL" ]] && error "前端部署失败"
success "管理后台部署成功: $ADMIN_URL"

# ---- 完成 ----
echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}           🎉 Vercel 部署完成！                ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "  🌐 管理后台: ${CYAN}$ADMIN_URL${NC}"
echo -e "  🔌 API 服务: ${CYAN}$API_URL${NC}"
echo ""
echo -e "  👤 默认账号: ${YELLOW}admin${NC}"
echo -e "  🔑 默认密码: ${YELLOW}Admin@123456${NC}  ← 登录后请立即修改！"
echo ""
echo -e "  💡 数据库种子数据初始化："
echo -e "     ${CYAN}cd packages/server && DATABASE_URL=\"$DB_URL\" npx ts-node prisma/seed.ts${NC}"
echo ""
