import { Hono } from 'hono';
import type { Env } from '../index';
import { listWithdrawals, updateWithdrawalStatus } from '../utils/db';
import { authenticate } from '../middlewares/auth';

export const withdrawalRoutes = new Hono<{ Bindings: Env }>();
withdrawalRoutes.use('*', authenticate());

// GET /api/withdrawals
withdrawalRoutes.get('/', async (c) => {
  const { page = '1', pageSize = '20', status, merchantId } = c.req.query();
  const { list, total } = await listWithdrawals(c.env.DB, {
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    status: status || undefined,
    merchantId: merchantId || undefined,
  });
  return c.json({ code: 0, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

// POST /api/withdrawals/:id/audit  → action: APPROVE | REJECT
withdrawalRoutes.post('/:id/audit', async (c) => {
  const id = c.req.param('id');
  const { action, remark } = await c.req.json<{ action: string; remark?: string }>();
  if (!['APPROVE', 'REJECT'].includes(action)) {
    return c.json({ code: 400, message: 'action 必须为 APPROVE 或 REJECT' }, 400);
  }
  const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  await updateWithdrawalStatus(c.env.DB, id, status, remark);
  return c.json({ code: 0, message: '操作成功' });
});

// POST /api/withdrawals/:id/transfer  → 标记已打款
withdrawalRoutes.post('/:id/transfer', async (c) => {
  const id = c.req.param('id');
  await updateWithdrawalStatus(c.env.DB, id, 'TRANSFERRED');
  return c.json({ code: 0, message: '已标记打款完成' });
});
