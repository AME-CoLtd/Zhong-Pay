import { Hono } from 'hono';
import type { Env } from '../index';
import { authenticate, requireRole } from '../middlewares/auth';
import { createAdmin, findAdminById, findAdminByUsername, listAdmins, updateAdmin, updateAdminPassword } from '../utils/db';
import { hashPassword } from '../utils/crypto';

export const adminRoutes = new Hono<{ Bindings: Env }>();
adminRoutes.use('*', authenticate());
adminRoutes.use('*', requireRole('SUPER_ADMIN'));

adminRoutes.get('/', async (c) => {
  const { page = '1', pageSize = '20' } = c.req.query();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
  const { list, total } = await listAdmins(c.env.DB, p, ps);
  return c.json({ code: 0, data: { list, total, page: p, pageSize: ps } });
});

adminRoutes.post('/', async (c) => {
  const { username, password, email, phone, role = 'STAFF' } = await c.req.json<{
    username?: string;
    password?: string;
    email?: string;
    phone?: string;
    role?: string;
  }>();

  if (!username || !password) {
    return c.json({ code: 400, message: '用户名和密码不能为空' }, 400);
  }
  if (password.length < 8) {
    return c.json({ code: 400, message: '密码至少 8 位' }, 400);
  }
  if (!['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role)) {
    return c.json({ code: 400, message: '角色不合法' }, 400);
  }

  const exists = await findAdminByUsername(c.env.DB, username);
  if (exists) return c.json({ code: 400, message: '用户名已存在' }, 400);

  try {
    const id = crypto.randomUUID();
    const hashed = await hashPassword(password);
    await createAdmin(c.env.DB, {
      id,
      username,
      password: hashed,
      email: email || null,
      phone: phone || null,
      role,
      isActive: 1,
    });
    return c.json({ code: 0, message: '用户创建成功', data: { id } });
  } catch (e: any) {
    return c.json({ code: 500, message: e?.message || '创建失败' }, 500);
  }
});

adminRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const { email, phone, role, isActive } = await c.req.json<{
    email?: string | null;
    phone?: string | null;
    role?: string;
    isActive?: boolean | number;
  }>();

  const target = await findAdminById(c.env.DB, id);
  if (!target) return c.json({ code: 404, message: '用户不存在' }, 404);

  if (role && !['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role)) {
    return c.json({ code: 400, message: '角色不合法' }, 400);
  }

  try {
    await updateAdmin(c.env.DB, id, {
      email,
      phone,
      role,
      isActive: isActive === undefined ? undefined : (isActive ? 1 : 0),
    });
    return c.json({ code: 0, message: '更新成功' });
  } catch (e: any) {
    return c.json({ code: 500, message: e?.message || '更新失败' }, 500);
  }
});

adminRoutes.post('/:id/reset-password', async (c) => {
  const id = c.req.param('id');
  const { password } = await c.req.json<{ password?: string }>();
  if (!password || password.length < 8) {
    return c.json({ code: 400, message: '新密码至少 8 位' }, 400);
  }

  const target = await findAdminById(c.env.DB, id);
  if (!target) return c.json({ code: 404, message: '用户不存在' }, 404);

  const hashed = await hashPassword(password);
  await updateAdminPassword(c.env.DB, id, hashed);
  return c.json({ code: 0, message: '密码重置成功' });
});
