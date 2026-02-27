import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  admin?: {
    id: string;
    username: string;
    role: string;
  };
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new AppError('未提供认证令牌', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      username: string;
      role: string;
    };

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id, isActive: true },
      select: { id: true, username: true, role: true },
    });

    if (!admin) {
      throw new AppError('账号不存在或已禁用', 401);
    }

    req.admin = admin;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(new AppError('认证失败，请重新登录', 401));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(new AppError('未认证', 401));
    }
    if (!roles.includes(req.admin.role)) {
      return next(new AppError('权限不足', 403));
    }
    next();
  };
}
