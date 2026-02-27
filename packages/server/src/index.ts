import 'dotenv/config';
import app from './app';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // 测试数据库连接
    await prisma.$connect();
    logger.info('数据库连接成功');

    app.listen(PORT, () => {
      logger.info(`🚀 众支付服务启动成功，端口: ${PORT}`);
      logger.info(`📚 API文档: http://localhost:${PORT}/api-docs`);
      logger.info(`🌍 运行环境: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('服务启动失败:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在优雅关闭...');
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
