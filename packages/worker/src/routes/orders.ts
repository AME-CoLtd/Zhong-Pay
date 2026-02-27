import { Hono } from 'hono';
import type { Env } from '../index';
import { getDB } from '../utils/db';
import { authenticate } from '../middlewares/auth';

export const orderRoutes = new Hono<{ Bindings: Env }>();
orderRoutes.use('*', authenticate());

orderRoutes.get('/', async (c) => {
  const { page = '1', pageSize = '20', keyword, status, payType } = c.req.query();
  const db = getDB(c.env.DATABASE_URL);
  const where: any = {};
  if (keyword) where.OR = [{ orderNo: { contains: keyword } }, { outTradeNo: { contains: keyword } }];
  if (status) where.status = status;
  if (payType) where.payType = payType;
  const p = parseInt(page), ps = parseInt(pageSize);
  const [total, list] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where, skip: (p - 1) * ps, take: ps,
      orderBy: { createdAt: 'desc' },
      include: { merchant: { select: { name: true } } },
    }),
  ]);
  return c.json({ code: 0, data: { list, total, page: p, pageSize: ps } });
});

orderRoutes.get('/:id', async (c) => {
  const db = getDB(c.env.DATABASE_URL);
  const order = await db.order.findUnique({
    where: { id: c.req.param('id') },
    include: { merchant: { select: { id: true, name: true } }, refunds: true },
  });
  if (!order) return c.json({ code: 404, message: '订单不存在' }, 404);
  return c.json({ code: 0, data: order });
});
