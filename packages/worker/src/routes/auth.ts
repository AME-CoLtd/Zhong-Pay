import { Hono } from 'hono';
import type { Env } from '../index';
import { getDB } from '../utils/db';
import { signJWT, verifyPassword } from '../utils/crypto';
import { authenticate } from '../middlewares/auth';

export const authRoutes = new Hono<{ Bindings: Env }>();

// 登录
authRoutes.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ code: 400, message: '用户名和密码不能为空' }, 400);
  }

  const db = getDB(c.env.DATABASE_URL);
  const admin = await db.admin.findUnique({ where: { username } });

  if (!admin || !admin.isActive) {
    return c.json({ code: 401, message: '账号不存在或已禁用' }, 401);
  }

  const isValid = await verifyPassword(password, admin.password);
  if (!isValid) {
    return c.json({ code: 401, message: '用户名或密码错误' }, 401);
  }

  const token = await signJWT(
    { id: admin.id, username: admin.username, role: admin.role },
    c.env.JWT_SECRET
  );

  await db.admin.update({ where: { id: admin.id }, data: { lastLogin: new Date() } });

  return c.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      admin: { id: admin.id, username: admin.username, email: admin.email, role: admin.role },
    },
  });
});

// 获取当前用户
authRoutes.get('/me', authenticate(), async (c) => {
  const admin = c.get('admin' as any) as any;
  const db = getDB(c.env.DATABASE_URL);
  const info = await db.admin.findUnique({
    where: { id: admin.id },
    select: { id: true, username: true, email: true, role: true, lastLogin: true },
  });
  return c.json({ code: 0, data: info });
});
