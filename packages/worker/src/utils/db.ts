/**
 * 连接外部数据库（PlanetScale / Neon / Supabase 等兼容 MySQL/PostgreSQL）
 * Workers 环境通过 HTTP 协议连接，不支持 TCP 直连
 *
 * 推荐组合：
 *   - PlanetScale（MySQL 兼容，有免费额度，支持 HTTP 驱动）
 *   - Neon（PostgreSQL，支持 HTTP 驱动）
 *   - Supabase（PostgreSQL）
 */
import { PrismaClient } from '@prisma/client';

// 每个 Worker 实例复用同一个连接
let _client: PrismaClient | null = null;

export function getDB(databaseUrl: string): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: ['error'],
    });
  }
  return _client;
}
