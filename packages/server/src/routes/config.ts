import { Router, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { prisma } from '../utils/prisma';
import { authenticate, requireRole, AuthRequest } from '../middlewares/auth';
import { AppError } from '../middlewares/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export const configRouter = Router();

configRouter.use(authenticate);

// 获取所有配置
configRouter.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    res.json({ code: 0, data: configs });
  } catch (err) {
    next(err);
  }
});

// 更新配置
configRouter.put(
  '/:key',
  requireRole('SUPER_ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { value, remark } = req.body;
      if (value === undefined) throw new AppError('配置值不能为空');

      const config = await prisma.systemConfig.upsert({
        where: { key: req.params.key },
        update: { value, remark },
        create: { id: uuidv4(), key: req.params.key, value, remark },
      });

      res.json({ code: 0, message: '配置更新成功', data: config });
    } catch (err) {
      next(err);
    }
  }
);
