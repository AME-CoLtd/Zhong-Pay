/**
 * Worker JWT 认证中间件
 */
import type { MiddlewareHandler, Context } from 'hono';
import type { Env } from '../index';

export interface AdminPayload {
  id: string;
  username: string;
  role: string;
}

// 轻量级 JWT 验证（Workers 环境使用 Web Crypto API）
async function verifyJWT(token: string, secret: string): Promise<AdminPayload> {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error('invalid token');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0)
  );
  const valid = await crypto.subtle.verify('HMAC', key, sig, data);
  if (!valid) throw new Error('invalid signature');

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('token expired');
  }

  return payload as AdminPayload;
}

export function authenticate(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return c.json({ code: 401, message: '未提供认证令牌' }, 401);
    }

    try {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      c.set('admin' as any, payload);
      return next();
    } catch {
      return c.json({ code: 401, message: '认证失败，请重新登录' }, 401);
    }
  };
}

export function requireRole(...roles: string[]): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const admin = c.get('admin' as any) as AdminPayload;
    if (!admin || !roles.includes(admin.role)) {
      return c.json({ code: 403, message: '权限不足' }, 403);
    }
    return next();
  };
}
