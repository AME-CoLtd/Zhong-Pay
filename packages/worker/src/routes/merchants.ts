import { Hono } from 'hono';
import type { Env } from '../index';
import { getDB } from '../utils/db';
import { authenticate, requireRole } from '../middlewares/auth';

export const merchantRoutes = new Hono<{ Bindings: Env }>();
merchantRoutes.use('*', authenticate());

merchantRoutes.get('/', async (c) => {
  const { page = '1', pageSize = '20', keyword, status } = c.req.query();
  const db = getDB(c.env.DATABASE_URL);
  const where: any = {};
  if (keyword) where.OR = [{ name: { contains: keyword } }, { email: { contains: keyword } }];
  if (status) where.status = status;
  const p = parseInt(page), ps = parseInt(pageSize);
  const [total, list] = await Promise.all([
    db.merchant.count({ where }),
    db.merchant.findMany({
      where, skip: (p - 1) * ps, take: ps,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, phone: true, apiKey: true, status: true, balance: true, totalIncome: true, feeRate: true, createdAt: true },
    }),
  ]);
  return c.json({ code: 0, data: { list, total, page: p, pageSize: ps } });
});

merchantRoutes.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const body = await c.req.json();
  const { name, email, phone, notifyUrl, returnUrl, feeRate, remark } = body;
  if (!name || !email) return c.json({ code: 400, message: '商户名称和邮箱不能为空' }, 400);

  const db = getDB(c.env.DATABASE_URL);
  const apiKey = 'mk_' + crypto.randomUUID().replace(/-/g, '');
  const apiSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

  const merchant = await db.merchant.create({
    data: { id: crypto.randomUUID(), name, email, phone, apiKey, apiSecret, notifyUrl, returnUrl, feeRate: feeRate || 0.006, remark },
  });
  return c.json({ code: 0, message: '商户创建成功', data: merchant });
});

merchantRoutes.get('/:id', async (c) => {
  const db = getDB(c.env.DATABASE_URL);
  const merchant = await db.merchant.findUnique({
    where: { id: c.req.param('id') },
    include: { _count: { select: { orders: true } } },
  });
  if (!merchant) return c.json({ code: 404, message: '商户不存在' }, 404);
  return c.json({ code: 0, data: merchant });
});

merchantRoutes.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const body = await c.req.json();
  const db = getDB(c.env.DATABASE_URL);
  const merchant = await db.merchant.update({ where: { id: c.req.param('id') }, data: body });
  return c.json({ code: 0, message: '更新成功', data: merchant });
});

merchantRoutes.post('/:id/reset-key', requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const db = getDB(c.env.DATABASE_URL);
  const apiKey = 'mk_' + crypto.randomUUID().replace(/-/g, '');
  const apiSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const m = await db.merchant.update({ where: { id: c.req.param('id') }, data: { apiKey, apiSecret } });
  return c.json({ code: 0, message: 'API密钥已重置', data: { apiKey: m.apiKey, apiSecret: m.apiSecret } });
});
