import { Router, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';

export const orderRouter = Router();

orderRouter.use(authenticate);

// 获取订单列表
orderRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const { keyword, status, payType, merchantId, startDate, endDate } = req.query;

    const where: any = {};
    if (keyword) {
      where.OR = [
        { orderNo: { contains: keyword as string } },
        { outTradeNo: { contains: keyword as string } },
        { subject: { contains: keyword as string } },
      ];
    }
    if (status) where.status = status;
    if (payType) where.payType = payType;
    if (merchantId) where.merchantId = merchantId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const [total, list] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          merchant: { select: { name: true } },
        },
      }),
    ]);

    res.json({ code: 0, data: { list, total, page, pageSize } });
  } catch (err) {
    next(err);
  }
});

// 获取订单详情
orderRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        merchant: { select: { id: true, name: true, email: true } },
        refunds: true,
      },
    });
    if (!order) throw new AppError('订单不存在', 404);
    res.json({ code: 0, data: order });
  } catch (err) {
    next(err);
  }
});

// 关闭订单
orderRouter.post('/:id/close', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError('订单不存在', 404);
    if (order.status !== 'PENDING') throw new AppError('只能关闭待支付的订单');

    await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    res.json({ code: 0, message: '订单已关闭' });
  } catch (err) {
    next(err);
  }
});
