import { Router, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import { generateWithdrawNo } from '../utils/helpers';

export const withdrawRouter = Router();

withdrawRouter.use(authenticate);

// 提现列表
withdrawRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const { status, merchantId } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (merchantId) where.merchantId = merchantId;

    const [total, list] = await Promise.all([
      prisma.withdrawal.count({ where }),
      prisma.withdrawal.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { merchant: { select: { name: true } } },
      }),
    ]);

    res.json({ code: 0, data: { list, total, page, pageSize } });
  } catch (err) {
    next(err);
  }
});

// 审核提现
withdrawRouter.post(
  '/:id/audit',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  [body('action').isIn(['APPROVE', 'REJECT']).withMessage('action必须是APPROVE或REJECT')],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg);

      const { action, auditRemark } = req.body;
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });

      if (!withdrawal) throw new AppError('提现记录不存在', 404);
      if (withdrawal.status !== 'PENDING') throw new AppError('该提现申请已处理');

      if (action === 'APPROVE') {
        await prisma.withdrawal.update({
          where: { id: req.params.id },
          data: { status: 'APPROVED', auditRemark, auditedAt: new Date() },
        });
      } else {
        // 拒绝则退还余额
        await prisma.$transaction([
          prisma.withdrawal.update({
            where: { id: req.params.id },
            data: { status: 'REJECTED', auditRemark, auditedAt: new Date() },
          }),
          prisma.merchant.update({
            where: { id: withdrawal.merchantId },
            data: { balance: { increment: withdrawal.amount } },
          }),
        ]);
      }

      res.json({ code: 0, message: action === 'APPROVE' ? '已审核通过' : '已拒绝' });
    } catch (err) {
      next(err);
    }
  }
);

// 标记已打款
withdrawRouter.post(
  '/:id/transfer',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
      if (!withdrawal) throw new AppError('提现记录不存在', 404);
      if (withdrawal.status !== 'APPROVED') throw new AppError('请先审核通过再打款');

      await prisma.withdrawal.update({
        where: { id: req.params.id },
        data: { status: 'TRANSFERRED', transferredAt: new Date() },
      });

      res.json({ code: 0, message: '已标记打款成功' });
    } catch (err) {
      next(err);
    }
  }
);
