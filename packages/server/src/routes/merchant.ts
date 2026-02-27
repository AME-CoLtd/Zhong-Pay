import { Router, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';

export const merchantRouter = Router();

merchantRouter.use(authenticate);

// 获取商户列表
merchantRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const keyword = req.query.keyword as string;
    const status = req.query.status as string;

    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { email: { contains: keyword } },
      ];
    }
    if (status) where.status = status;

    const [total, list] = await Promise.all([
      prisma.merchant.count({ where }),
      prisma.merchant.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          apiKey: true,
          status: true,
          balance: true,
          totalIncome: true,
          feeRate: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({ code: 0, data: { list, total, page, pageSize } });
  } catch (err) {
    next(err);
  }
});

// 创建商户
merchantRouter.post(
  '/',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  [
    body('name').notEmpty().withMessage('商户名称不能为空'),
    body('email').isEmail().withMessage('邮箱格式不正确'),
    body('feeRate').isFloat({ min: 0, max: 1 }).withMessage('费率范围0-1'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg);

      const { name, email, phone, notifyUrl, returnUrl, feeRate, remark } = req.body;

      const apiKey = 'mk_' + uuidv4().replace(/-/g, '');
      const apiSecret = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');

      const merchant = await prisma.merchant.create({
        data: {
          id: uuidv4(),
          name,
          email,
          phone,
          apiKey,
          apiSecret,
          notifyUrl,
          returnUrl,
          feeRate: feeRate || 0.006,
          remark,
        },
      });

      res.json({ code: 0, message: '商户创建成功', data: merchant });
    } catch (err) {
      next(err);
    }
  }
);

// 获取商户详情
merchantRouter.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { orders: true } },
      },
    });
    if (!merchant) throw new AppError('商户不存在', 404);
    res.json({ code: 0, data: merchant });
  } catch (err) {
    next(err);
  }
});

// 更新商户
merchantRouter.put(
  '/:id',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, phone, notifyUrl, returnUrl, feeRate, status, remark } = req.body;
      const merchant = await prisma.merchant.update({
        where: { id: req.params.id },
        data: { name, phone, notifyUrl, returnUrl, feeRate, status, remark },
      });
      res.json({ code: 0, message: '更新成功', data: merchant });
    } catch (err) {
      next(err);
    }
  }
);

// 重置API密钥
merchantRouter.post(
  '/:id/reset-key',
  requireRole('SUPER_ADMIN', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const apiKey = 'mk_' + uuidv4().replace(/-/g, '');
      const apiSecret = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
      const merchant = await prisma.merchant.update({
        where: { id: req.params.id },
        data: { apiKey, apiSecret },
      });
      res.json({
        code: 0,
        message: 'API密钥已重置',
        data: { apiKey: merchant.apiKey, apiSecret: merchant.apiSecret },
      });
    } catch (err) {
      next(err);
    }
  }
);
