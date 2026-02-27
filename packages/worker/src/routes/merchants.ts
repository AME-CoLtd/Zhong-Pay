import { Hono } from 'hono';
import type { Env } from '../index';
import { listMerchants, findMerchantById, createMerchant, updateMerchant, resetMerchantKey } from '../utils/db';
import { authenticate, requireRole } from '../middlewares/auth';

export const merchantRoutes = new Hono<{ Bindings: Env }>();
merchantRoutes.use('*', authenticate());

merchantRoutes.get('/', async (c) => {
  const { page = '1', pageSize = '20' } = c.req.query();
  const { list, total } = await listMerchants(c.env.DB, parseInt(page), parseInt(pageSize));
  return c.json({ code: 0, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

merchantRoutes.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const body = await c.req.json();
  const { name, email, phone, notifyUrl, returnUrl, feeRate, remark } = body;
  if (!name || !email) return c.json({ code: 400, message: '商户名称和邮箱不能为空' }, 400);
  const apiKey    = 'mk_' + crypto.randomUUID().replace(/-/g, '');
  const apiSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const id        = crypto.randomUUID();
  await createMerchant(c.env.DB, { id, name, email, phone, apiKey, apiSecret, notifyUrl, returnUrl, feeRate, remark });
  return c.json({ code: 0, message: '商户创建成功', data: { id, apiKey } });
});

merchantRoutes.get('/:id', async (c) => {
  const merchant = await findMerchantById(c.env.DB, c.req.param('id'));
  if (!merchant) return c.json({ code: 404, message: '商户不存在' }, 404);
  return c.json({ code: 0, data: merchant });
});

merchantRoutes.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const body = await c.req.json();
  await updateMerchant(c.env.DB, c.req.param('id'), body);
  return c.json({ code: 0, message: '更新成功' });
});

merchantRoutes.post('/:id/reset-key', requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const apiKey    = 'mk_' + crypto.randomUUID().replace(/-/g, '');
  const apiSecret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await resetMerchantKey(c.env.DB, c.req.param('id'), apiKey, apiSecret);
  return c.json({ code: 0, message: 'API密钥已重置', data: { apiKey, apiSecret } });
});
