import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { authRouter } from './routes/auth';
import { merchantRouter } from './routes/merchant';
import { orderRouter } from './routes/order';
import { payRouter } from './routes/pay';
import { notifyRouter } from './routes/notify';
import { withdrawRouter } from './routes/withdraw';
import { statsRouter } from './routes/stats';
import { configRouter } from './routes/config';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';

const app = express();

// 安全头
app.use(helmet());

// 跨域
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 请求限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 200,
  message: { code: 429, message: '请求过于频繁，请稍后再试' },
});
app.use('/api/', limiter);

// 支付回调不限流
const notifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 500,
});
app.use('/api/notify', notifyLimiter);

// 请求日志
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: '众支付' });
});

// API路由
app.use('/api/auth', authRouter);
app.use('/api/merchants', merchantRouter);
app.use('/api/orders', orderRouter);
app.use('/api/pay', payRouter);
app.use('/api/notify', notifyRouter);
app.use('/api/withdrawals', withdrawRouter);
app.use('/api/stats', statsRouter);
app.use('/api/configs', configRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' });
});

// 错误处理
app.use(errorHandler);

export default app;
