#!/usr/bin/env bash
# =============================================================
# 众支付 - Docker 一键部署脚本
# 适用于 Linux / macOS / WSL
# 使用: bash scripts/deploy-docker.sh [--env-file /path/to/.env]
# =============================================================
set -euo pipefail

# ---- 颜色 ----
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
echo -e "${CYAN}         众支付 Docker 一键部署脚本             ${NC}"
echo -e "${CYAN}=================================================${NC}"
echo ""

# ---- 解析参数 ----
ENV_FILE="$PROJECT_DIR/.env"
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) ENV_FILE="$2"; shift 2 ;;
    *) warn "未知参数: $1"; shift ;;
  esac
done

# ---- 检查依赖 ----
info "检查依赖..."
command -v docker   >/dev/null 2>&1 || error "请先安装 Docker: https://docs.docker.com/get-docker/"
command -v docker-compose >/dev/null 2>&1 || \
  docker compose version >/dev/null 2>&1 || \
  error "请先安装 Docker Compose"
success "Docker 已就绪: $(docker --version)"

# ---- 初始化 .env ----
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env 文件不存在，正在从模板创建..."
  cp "$PROJECT_DIR/.env.example" "$ENV_FILE"

  # 自动生成 JWT Secret
  if command -v openssl >/dev/null 2>&1; then
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s|please-change-this-to-a-strong-random-secret|$JWT_SECRET|g" "$ENV_FILE"
    success "已自动生成 JWT_SECRET"
  fi

  warn "请编辑 $ENV_FILE 填写支付配置后重新运行此脚本"
  echo ""
  read -rp "现在打开配置文件？[Y/n] " confirm
  if [[ "${confirm,,}" != "n" ]]; then
    ${EDITOR:-nano} "$ENV_FILE"
  fi
fi

# ---- 加载环境变量 ----
# shellcheck disable=SC1090
source "$ENV_FILE"
export $(grep -v '^#' "$ENV_FILE" | xargs) 2>/dev/null || true

# ---- 检查关键配置 ----
info "检查关键配置..."
[[ -z "${JWT_SECRET:-}" ]] && error "JWT_SECRET 未配置"
[[ "${JWT_SECRET}" == *"please-change"* ]] && error "请修改 JWT_SECRET 为安全的随机字符串"
[[ -z "${MYSQL_PASSWORD:-}" ]] && error "MYSQL_PASSWORD 未配置"
success "配置检查通过"

cd "$PROJECT_DIR"

# ---- 构建前端 ----
info "构建管理后台..."
if command -v node >/dev/null 2>&1; then
  cd packages/admin
  [[ ! -d node_modules ]] && npm install --silent
  VITE_API_URL="${VITE_API_URL:-}" npm run build --silent
  cd "$PROJECT_DIR"
  success "前端构建完成 → packages/admin/dist/"
else
  warn "未检测到 Node.js，跳过前端构建（如已有 dist 可继续）"
fi

# ---- 停止旧容器 ----
info "停止旧容器..."
docker-compose down --remove-orphans 2>/dev/null || true

# ---- 启动服务 ----
info "启动 Docker 服务..."
docker-compose up -d --build

# ---- 等待数据库就绪 ----
info "等待数据库就绪..."
MAX_RETRIES=30
for i in $(seq 1 $MAX_RETRIES); do
  if docker-compose exec -T mysql mysqladmin ping -h localhost -uroot -p"${MYSQL_ROOT_PASSWORD:-zhongpay_root_123}" --silent 2>/dev/null; then
    success "数据库已就绪"
    break
  fi
  if [[ $i -eq $MAX_RETRIES ]]; then
    error "数据库启动超时，请检查日志: docker-compose logs mysql"
  fi
  printf "."
  sleep 2
done

# ---- 运行数据库迁移 ----
info "运行数据库迁移..."
docker-compose exec -T server sh -c "npx prisma migrate deploy" && success "数据库迁移完成"

# ---- 运行种子数据（首次部署） ----
SEED_FLAG="$PROJECT_DIR/.seeded"
if [[ ! -f "$SEED_FLAG" ]]; then
  info "初始化种子数据..."
  if docker-compose exec -T server sh -c "npx ts-node prisma/seed.ts" 2>/dev/null; then
    touch "$SEED_FLAG"
    success "种子数据初始化完成"
  else
    warn "种子数据初始化失败（如非首次部署可忽略）"
  fi
fi

# ---- 检查服务状态 ----
echo ""
info "检查服务状态..."
sleep 3
docker-compose ps

# ---- 完成 ----
echo ""
echo -e "${GREEN}=================================================${NC}"
echo -e "${GREEN}           🎉 部署完成！                       ${NC}"
echo -e "${GREEN}=================================================${NC}"
echo ""
echo -e "  🌐 管理后台:  ${CYAN}http://localhost:${HTTP_PORT:-80}${NC}"
echo -e "  🔌 API 服务:  ${CYAN}http://localhost:${HTTP_PORT:-80}/api${NC}"
echo -e "  ❤️  健康检查: ${CYAN}http://localhost:${HTTP_PORT:-80}/health${NC}"
echo ""
echo -e "  👤 默认账号: ${YELLOW}admin${NC}"
echo -e "  🔑 默认密码: ${YELLOW}Admin@123456${NC}  ← 登录后请立即修改！"
echo ""
echo -e "  📋 查看日志: ${CYAN}docker-compose logs -f server${NC}"
echo -e "  🛑 停止服务: ${CYAN}docker-compose down${NC}"
echo ""
