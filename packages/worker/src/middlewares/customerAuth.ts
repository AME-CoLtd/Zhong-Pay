import type { MiddlewareHandler } from 'hono';
import type { Env } from '../index';

interface CustomerPayload {
  customerId: string;
  username: string;
  type: 'customer';
  exp?: number;
}

async function verifyJWT(token: string, secret: string): Promise<CustomerPayload> {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error('invalid token');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const sig = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sig, data);
  if (!valid) throw new Error('invalid signature');

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('token expired');
  }
  return payload as CustomerPayload;
}

export function authenticateCustomer(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ code: 401, message: '未登录' }, 401);

    try {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (payload.type !== 'customer') {
        return c.json({ code: 401, message: '认证失败' }, 401);
      }
      c.set('customer' as any, payload);
      return next();
    } catch {
      return c.json({ code: 401, message: '登录已失效，请重新登录' }, 401);
    }
  };
}
