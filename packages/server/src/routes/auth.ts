import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { authenticate, AuthRequest } from '../middlewares/auth';

export const authRouter = Router();

// 登录
authRouter.post(
  '/login',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg);
      }

      const { username, password } = req.body;

      const admin = await prisma.admin.findUnique({ where: { username } });
      if (!admin || !admin.isActive) {
        throw new AppError('账号不存在或已禁用', 401);
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        throw new AppError('用户名或密码错误', 401);
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username, role: admin.role },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      await prisma.admin.update({
        where: { id: admin.id },
        data: { lastLogin: new Date() },
      });

      res.json({
        code: 0,
        message: '登录成功',
        data: {
          token,
          admin: {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            role: admin.role,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 获取当前用户信息
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin!.id },
      select: { id: true, username: true, email: true, role: true, lastLogin: true, createdAt: true },
    });
    res.json({ code: 0, data: admin });
  } catch (err) {
    next(err);
  }
});

// 修改密码
authRouter.put(
  '/password',
  authenticate,
  [
    body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
    body('newPassword').isLength({ min: 8 }).withMessage('新密码至少8位'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg);
      }

      const { oldPassword, newPassword } = req.body;
      const admin = await prisma.admin.findUnique({ where: { id: req.admin!.id } });

      if (!admin) throw new AppError('管理员不存在', 404);

      const isMatch = await bcrypt.compare(oldPassword, admin.password);
      if (!isMatch) throw new AppError('旧密码错误');

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.admin.update({
        where: { id: req.admin!.id },
        data: { password: hashed },
      });

      res.json({ code: 0, message: '密码修改成功' });
    } catch (err) {
      next(err);
    }
  }
);
