import { Hono } from 'hono';
import type { Env } from '../index';
import { listOrders, findOrderById } from '../utils/db';
import { authenticate } from '../middlewares/auth';

export const orderRoutes = new Hono<{ Bindings: Env }>();
orderRoutes.use('*', authenticate());

orderRoutes.get('/', async (c) => {
  const { page = '1', pageSize = '20', keyword, status, payType, startDate, endDate } = c.req.query();
  const { list, total } = await listOrders(c.env.DB, {
    page: parseInt(page), pageSize: parseInt(pageSize),
    keyword, status, payType, startDate, endDate,
  });
  return c.json({ code: 0, data: { list, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
});

orderRoutes.get('/:id', async (c) => {
  const order = await findOrderById(c.env.DB, c.req.param('id'));
  if (!order) return c.json({ code: 404, message: '订单不存在' }, 404);
  return c.json({ code: 0, data: order });
});
