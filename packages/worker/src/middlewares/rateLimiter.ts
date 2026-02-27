/**
 * Worker KV 限流中间件
 */
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../index';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

export function rateLimiter(opts: RateLimiterOptions): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const ip =
      c.req.header('CF-Connecting-IP') ||
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
      'unknown';

    const key = `ratelimit:${ip}:${Math.floor(Date.now() / opts.windowMs)}`;

    try {
      const kv = c.env.KV;
      const current = await kv.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= opts.max) {
        return c.json({ code: 429, message: '请求过于频繁，请稍后再试' }, 429);
      }

      await kv.put(key, String(count + 1), {
        expirationTtl: Math.ceil(opts.windowMs / 1000),
      });
    } catch {
      // KV 不可用时放行（降级处理）
    }

    return next();
  };
}
