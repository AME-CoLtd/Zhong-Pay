import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../utils/prisma';
import { AppError } from '../middlewares/errorHandler';
import { generateOrderNo } from '../utils/helpers';
import { alipayPagePay, alipayWapPay, alipayQrcode } from '../services/alipay.service';
import { wechatNativePay, wechatH5Pay } from '../services/wechat.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export const payRouter = Router();

/**
 * 验证商户签名
 */
function verifyMerchantSign(
  params: Record<string, any>,
  apiSecret: string
): boolean {
  const { sign, ...rest } = params;
  const sortedKeys = Object.keys(rest).sort();
  const str = sortedKeys
    .filter((k) => rest[k] !== '' && rest[k] !== null && rest[k] !== undefined)
    .map((k) => `${k}=${rest[k]}`)
    .join('&') + `&key=${apiSecret}`;
  const expected = crypto.createHash('md5').update(str).digest('hex').toUpperCase();
  return expected === sign?.toUpperCase();
}

/**
 * 统一下单接口
 * POST /api/pay/unified
 * 
 * 参数:
 *   apiKey: 商户API Key
 *   outTradeNo: 商户订单号
 *   subject: 商品名称
 *   amount: 金额（元）
 *   channel: 支付渠道
 *   notifyUrl: 回调地址（可选，优先于商户配置）
 *   returnUrl: 返回地址（可选）
 *   clientIp: 客户端IP
 *   sign: 签名
 */
payRouter.post(
  '/unified',
  [
    body('apiKey').notEmpty().withMessage('apiKey不能为空'),
    body('outTradeNo').notEmpty().withMessage('商户订单号不能为空'),
    body('subject').notEmpty().withMessage('商品名称不能为空'),
    body('amount').isFloat({ min: 0.01 }).withMessage('金额必须大于0.01'),
    body('channel').notEmpty().withMessage('支付渠道不能为空'),
    body('sign').notEmpty().withMessage('签名不能为空'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg);

      const { apiKey, outTradeNo, subject, body: orderBody, amount, channel, notifyUrl, returnUrl, clientIp, sign } = req.body;

      // 验证商户
      const merchant = await prisma.merchant.findUnique({ where: { apiKey } });
      if (!merchant || merchant.status !== 'ACTIVE') {
        throw new AppError('商户不存在或已禁用', 403);
      }

      // 验证签名
      if (!verifyMerchantSign(req.body, merchant.apiSecret)) {
        throw new AppError('签名验证失败', 403);
      }

      // 检查订单号是否重复
      const existOrder = await prisma.order.findFirst({
        where: { merchantId: merchant.id, outTradeNo },
      });
      if (existOrder) {
        // 返回已有订单（幂等处理）
        return res.json({ code: 0, data: formatOrderResponse(existOrder, channel) });
      }

      // 确定支付类型
      const payType = channel.startsWith('ALIPAY') ? 'ALIPAY' : 'WECHAT';

      // 计算过期时间（30分钟）
      const expiredAt = new Date(Date.now() + 30 * 60 * 1000);

      // 创建订单
      const orderNo = generateOrderNo();
      const order = await prisma.order.create({
        data: {
          id: uuidv4(),
          orderNo,
          merchantId: merchant.id,
          outTradeNo,
          subject,
          body: orderBody,
          amount,
          payType,
          channel,
          status: 'PENDING',
          clientIp: clientIp || req.ip,
          notifyUrl: notifyUrl || merchant.notifyUrl,
          returnUrl: returnUrl || merchant.returnUrl,
          expiredAt,
        },
      });

      // 调用支付渠道
      let payData: any = {};
      const actualNotifyUrl = notifyUrl || merchant.notifyUrl || '';
      const actualReturnUrl = returnUrl || merchant.returnUrl || '';

      try {
        switch (channel) {
          case 'ALIPAY_PC':
            payData.payUrl = await alipayPagePay({
              orderNo,
              amount: Number(amount).toFixed(2),
              subject,
              notifyUrl: actualNotifyUrl,
              returnUrl: actualReturnUrl,
            });
            break;

          case 'ALIPAY_WAP':
            payData.payUrl = await alipayWapPay({
              orderNo,
              amount: Number(amount).toFixed(2),
              subject,
              notifyUrl: actualNotifyUrl,
              returnUrl: actualReturnUrl,
            });
            break;

          case 'ALIPAY_QRCODE':
            payData.qrCode = await alipayQrcode({
              orderNo,
              amount: Number(amount).toFixed(2),
              subject,
              notifyUrl: actualNotifyUrl,
            });
            break;

          case 'WECHAT_NATIVE':
            payData.codeUrl = await wechatNativePay({
              orderNo,
              amount: Math.round(Number(amount) * 100),
              subject,
              clientIp: clientIp || req.ip || '127.0.0.1',
              notifyUrl: actualNotifyUrl,
            });
            break;

          case 'WECHAT_H5':
            payData.payUrl = await wechatH5Pay({
              orderNo,
              amount: Math.round(Number(amount) * 100),
              subject,
              clientIp: clientIp || req.ip || '127.0.0.1',
              notifyUrl: actualNotifyUrl,
            });
            break;

          default:
            throw new AppError(`不支持的支付渠道: ${channel}`);
        }
      } catch (payErr: any) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'FAILED' },
        });
        logger.error('支付下单失败:', payErr);
        throw new AppError(`支付下单失败: ${payErr.message}`);
      }

      res.json({
        code: 0,
        message: '下单成功',
        data: {
          orderNo,
          outTradeNo,
          amount,
          channel,
          expiredAt,
          ...payData,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * 查询订单状态
 * GET /api/pay/query
 */
payRouter.get('/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey, orderNo, outTradeNo, sign } = req.query as Record<string, string>;

    if (!apiKey) throw new AppError('apiKey不能为空');
    if (!orderNo && !outTradeNo) throw new AppError('订单号不能为空');

    const merchant = await prisma.merchant.findUnique({ where: { apiKey } });
    if (!merchant) throw new AppError('商户不存在', 403);

    if (!verifyMerchantSign(req.query as any, merchant.apiSecret)) {
      throw new AppError('签名验证失败', 403);
    }

    const where: any = { merchantId: merchant.id };
    if (orderNo) where.orderNo = orderNo;
    if (outTradeNo) where.outTradeNo = outTradeNo;

    const order = await prisma.order.findFirst({ where });
    if (!order) throw new AppError('订单不存在', 404);

    res.json({
      code: 0,
      data: {
        orderNo: order.orderNo,
        outTradeNo: order.outTradeNo,
        status: order.status,
        amount: order.amount,
        actualAmount: order.actualAmount,
        payType: order.payType,
        paidAt: order.paidAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

function formatOrderResponse(order: any, channel: string) {
  return {
    orderNo: order.orderNo,
    outTradeNo: order.outTradeNo,
    status: order.status,
    amount: order.amount,
    channel,
  };
}
