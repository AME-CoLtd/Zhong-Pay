import { Hono } from 'hono';
import type { Env } from '../index';
import { findAdminByUsername, findAdminById, updateAdminLastLogin, updateAdminPassword, updateAdminEmail, updateAdminPhone } from '../utils/db';
import { signJWT, verifyPassword, hashPassword } from '../utils/crypto';
import { authenticate } from '../middlewares/auth';

export const authRoutes = new Hono<{ Bindings: Env }>();

// 登录
authRoutes.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  if (!username || !password)
    return c.json({ code: 400, message: '用户名和密码不能为空' }, 400);

  const admin = await findAdminByUsername(c.env.DB, username);
  if (!admin || !admin.is_active)
    return c.json({ code: 401, message: '账号不存在或已禁用' }, 401);

  const isValid = await verifyPassword(password, admin.password);
  if (!isValid)
    return c.json({ code: 401, message: '用户名或密码错误' }, 401);

  const token = await signJWT(
    { id: admin.id, username: admin.username, role: admin.role },
    c.env.JWT_SECRET
  );
  await updateAdminLastLogin(c.env.DB, admin.id);
  // 首次登录自动将 plain: 密码升级为 PBKDF2
  if (admin.password.startsWith('plain:')) {
    const hashed = await hashPassword(password);
    await updateAdminPassword(c.env.DB, admin.id, hashed);
  }

  return c.json({
    code: 0, message: '登录成功',
    data: {
      token,
      admin: { id: admin.id, username: admin.username, email: admin.email, phone: admin.phone, role: admin.role },
    },
  });
});

// 获取当前用户
authRoutes.get('/me', authenticate(), async (c) => {
  const { id } = c.get('admin' as any) as any;
  const info = await findAdminById(c.env.DB, id);
  if (!info) return c.json({ code: 404, message: '用户不存在' }, 404);
  return c.json({ code: 0, data: info });
});

// 修改密码
authRoutes.put('/password', authenticate(), async (c) => {
  const { oldPassword, newPassword } = await c.req.json();
  const { id } = c.get('admin' as any) as any;
  const admin = await findAdminByUsername(c.env.DB, (c.get('admin' as any) as any).username);
  if (!admin) return c.json({ code: 404, message: '用户不存在' }, 404);
  const valid = await verifyPassword(oldPassword, admin.password);
  if (!valid) return c.json({ code: 400, message: '当前密码错误' }, 400);
  const hashed = await hashPassword(newPassword);
  await updateAdminPassword(c.env.DB, id, hashed);
  return c.json({ code: 0, message: '密码修改成功' });
});

// 绑定邮箱
authRoutes.post('/bind-email', authenticate(), async (c) => {
  const { email } = await c.req.json();
  const { id } = c.get('admin' as any) as any;
  await updateAdminEmail(c.env.DB, id, email);
  return c.json({ code: 0, message: '邮箱绑定成功' });
});

// 绑定手机
authRoutes.post('/bind-phone', authenticate(), async (c) => {
  const { phone } = await c.req.json();
  const { id } = c.get('admin' as any) as any;
  await updateAdminPhone(c.env.DB, id, phone);
  return c.json({ code: 0, message: '手机号绑定成功' });
});

// 发送邮箱验证码（需配置邮件服务，当前仅 mock）
authRoutes.post('/send-email-code', authenticate(), async (c) => {
  const { email } = await c.req.json();
  if (!email) return c.json({ code: 400, message: '请输入邮箱' }, 400);
  // TODO: 集成邮件服务后实现真实发送
  return c.json({ code: 0, message: '验证码已发送（当前为测试模式，请跳过验证码直接提交）' });
});

// 发送短信验证码（需配置短信服务，当前仅 mock）
authRoutes.post('/send-sms-code', authenticate(), async (c) => {
  const { phone } = await c.req.json();
  if (!phone) return c.json({ code: 400, message: '请输入手机号' }, 400);
  // TODO: 集成短信服务后实现真实发送
  return c.json({ code: 0, message: '验证码已发送（当前为测试模式，请跳过验证码直接提交）' });
});
