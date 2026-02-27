import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  code: number;

  constructor(message: string, statusCode: number = 400, code?: number) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
    });
  }

  // Prisma错误处理
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      return res.status(400).json({
        code: 400,
        message: '数据已存在，请勿重复提交',
      });
    }
    if (prismaErr.code === 'P2025') {
      return res.status(404).json({
        code: 404,
        message: '数据不存在',
      });
    }
  }

  logger.error('未处理错误:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  res.status(500).json({
    code: 500,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
}
