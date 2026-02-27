import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middlewares/auth';
import dayjs from 'dayjs';

export const statsRouter = Router();

statsRouter.use(authenticate);

// 总览统计
statsRouter.get('/overview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const today = dayjs().startOf('day').toDate();
    const yesterday = dayjs().subtract(1, 'day').startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();

    const [
      totalOrders,
      paidOrders,
      todayOrders,
      monthOrders,
      totalMerchants,
      activeMerchants,
      pendingWithdrawals,
      totalRevenue,
      todayRevenue,
      monthRevenue,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.merchant.count(),
      prisma.merchant.count({ where: { status: 'ACTIVE' } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { actualAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: 'PAID', paidAt: { gte: today } },
        _sum: { actualAmount: true },
      }),
      prisma.order.aggregate({
        where: { status: 'PAID', paidAt: { gte: monthStart } },
        _sum: { actualAmount: true },
      }),
    ]);

    res.json({
      code: 0,
      data: {
        orders: {
          total: totalOrders,
          paid: paidOrders,
          today: todayOrders,
          thisMonth: monthOrders,
        },
        merchants: {
          total: totalMerchants,
          active: activeMerchants,
        },
        withdrawals: {
          pending: pendingWithdrawals,
        },
        revenue: {
          total: totalRevenue._sum.actualAmount || 0,
          today: todayRevenue._sum.actualAmount || 0,
          thisMonth: monthRevenue._sum.actualAmount || 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// 近7天订单趋势
statsRouter.get('/trend', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day');
      const start = date.startOf('day').toDate();
      const end = date.endOf('day').toDate();

      const [orders, revenue] = await Promise.all([
        prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
        prisma.order.aggregate({
          where: { status: 'PAID', paidAt: { gte: start, lte: end } },
          _sum: { actualAmount: true },
        }),
      ]);

      result.push({
        date: date.format('MM-DD'),
        orders,
        revenue: revenue._sum.actualAmount || 0,
      });
    }

    res.json({ code: 0, data: result });
  } catch (err) {
    next(err);
  }
});

// 支付渠道分布
statsRouter.get('/channel', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channelStats = await prisma.order.groupBy({
      by: ['payType', 'status'],
      where: { status: 'PAID' },
      _count: { id: true },
      _sum: { actualAmount: true },
    });

    res.json({ code: 0, data: channelStats });
  } catch (err) {
    next(err);
  }
});
