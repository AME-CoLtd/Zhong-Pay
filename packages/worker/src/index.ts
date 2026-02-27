/**
 * 众支付 - Cloudflare Worker 入口
 * 基于 Hono 框架，完全兼容 CF Workers 边缘运行时
 *
 * 架构说明：
 *   - 使用 Hono 替代 Express（Workers 环境不支持 Node.js http 模块）
 *   - 数据库通过环境变量 DATABASE_URL 连接外部 PlanetScale / Neon / Supabase
 *   - 会话限流使用 KV 存储
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { authRoutes } from './routes/auth';
import { payRoutes } from './routes/pay';
import { orderRoutes } from './routes/orders';
import { merchantRoutes } from './routes/merchants';
import { notifyRoutes } from './routes/notify';
import { statsRoutes } from './routes/stats';
import { configRoutes } from './routes/configs';
import { withdrawalRoutes } from './routes/withdrawals';
import { rateLimiter } from './middlewares/rateLimiter';

export interface Env {
  // D1 数据库
  DB: D1Database;
  // KV 存储（限流/缓存）
  KV: KVNamespace;
  // 环境变量（通过 wrangler secret put 设置）
  JWT_SECRET: string;
  ALIPAY_APP_ID: string;
  ALIPAY_PRIVATE_KEY: string;
  ALIPAY_PUBLIC_KEY: string;
  ALIPAY_NOTIFY_URL: string;
  WECHAT_APP_ID: string;
  WECHAT_MCH_ID: string;
  WECHAT_API_KEY: string;
  WECHAT_NOTIFY_URL: string;
  NODE_ENV: string;
  ALLOWED_ORIGINS: string;
}

const app = new Hono<{ Bindings: Env }>();

// 全局中间件
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', secureHeaders());

// CORS
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const origin = allowedOrigins.length > 0 ? allowedOrigins : [
    'https://admin.pay.amevn.site',
    'https://zhong-pay-admin.pages.dev',
  ];
  return cors({
    origin: (o) => (origin.includes('*') || origin.includes(o) ? o : origin[0]),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })(c, next);
});

// 健康检查
app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString(), runtime: 'cloudflare-workers' })
);

// API 路由（带限流）
app.use('/api/*', rateLimiter({ windowMs: 15 * 60 * 1000, max: 200 }));
app.route('/api/auth', authRoutes);
app.route('/api/pay', payRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/merchants', merchantRoutes);
app.route('/api/notify', notifyRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/configs', configRoutes);
app.route('/api/withdrawals', withdrawalRoutes);

// 404
app.notFound((c) => c.json({ code: 404, message: '接口不存在' }, 404));

// 错误处理
app.onError((err, c) => {
  console.error('Worker Error:', err);
  return c.json(
    {
      code: 500,
      message: c.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
    },
    500
  );
});

export default app;
