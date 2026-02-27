import { Hono } from 'hono';
import type { Env } from '../index';
import { getDB } from '../utils/db';
import { authenticate } from '../middlewares/auth';
import dayjs from 'dayjs';

export const statsRoutes = new Hono<{ Bindings: Env }>();
statsRoutes.use('*', authenticate());

statsRoutes.get('/overview', async (c) => {
  const db = getDB(c.env.DATABASE_URL);
  const today = dayjs().startOf('day').toDate();
  const monthStart = dayjs().startOf('month').toDate();

  const [totalOrders, paidOrders, todayOrders, monthOrders, totalMerchants, activeMerchants, pendingWithdrawals, totalRevenue, todayRevenue, monthRevenue] =
    await Promise.all([
      db.order.count(),
      db.order.count({ where: { status: 'PAID' } }),
      db.order.count({ where: { createdAt: { gte: today } } }),
      db.order.count({ where: { createdAt: { gte: monthStart } } }),
      db.merchant.count(),
      db.merchant.count({ where: { status: 'ACTIVE' } }),
      db.withdrawal.count({ where: { status: 'PENDING' } }),
      db.order.aggregate({ where: { status: 'PAID' }, _sum: { actualAmount: true } }),
      db.order.aggregate({ where: { status: 'PAID', paidAt: { gte: today } }, _sum: { actualAmount: true } }),
      db.order.aggregate({ where: { status: 'PAID', paidAt: { gte: monthStart } }, _sum: { actualAmount: true } }),
    ]);

  return c.json({
    code: 0,
    data: {
      orders: { total: totalOrders, paid: paidOrders, today: todayOrders, thisMonth: monthOrders },
      merchants: { total: totalMerchants, active: activeMerchants },
      withdrawals: { pending: pendingWithdrawals },
      revenue: {
        total: totalRevenue._sum.actualAmount || 0,
        today: todayRevenue._sum.actualAmount || 0,
        thisMonth: monthRevenue._sum.actualAmount || 0,
      },
    },
  });
});

statsRoutes.get('/trend', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const db = getDB(c.env.DATABASE_URL);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayjs().subtract(i, 'day');
    const start = date.startOf('day').toDate();
    const end = date.endOf('day').toDate();
    const [orders, revenue] = await Promise.all([
      db.order.count({ where: { createdAt: { gte: start, lte: end } } }),
      db.order.aggregate({ where: { status: 'PAID', paidAt: { gte: start, lte: end } }, _sum: { actualAmount: true } }),
    ]);
    result.push({ date: date.format('MM-DD'), orders, revenue: revenue._sum.actualAmount || 0 });
  }
  return c.json({ code: 0, data: result });
});
