import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { verifyAlipayNotify } from '../services/alipay.service';
import { verifyWechatNotify } from '../services/wechat.service';
import { logger } from '../utils/logger';
import axios from 'axios';

export const notifyRouter = Router();

/**
 * 支付宝异步回调
 */
notifyRouter.post('/alipay', async (req: Request, res: Response) => {
  try {
    const params = req.body;
    logger.info('收到支付宝回调:', { tradeNo: params.out_trade_no, status: params.trade_status });

    // 验证签名
    if (!verifyAlipayNotify(params)) {
      logger.warn('支付宝回调签名验证失败');
      return res.send('fail');
    }

    const { out_trade_no, trade_no, trade_status, total_amount, receipt_amount } = params;

    // 查询订单
    const order = await prisma.order.findFirst({
      where: { orderNo: out_trade_no },
    });

    if (!order) {
      logger.warn('支付宝回调订单不存在:', out_trade_no);
      return res.send('success'); // 返回success避免重复回调
    }

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      if (order.status === 'PENDING') {
        // 计算手续费
        const merchant = await prisma.merchant.findUnique({ where: { id: order.merchantId } });
        const feeRate = merchant?.feeRate || 0;
        const actualAmount = parseFloat(receipt_amount || total_amount);
        const feeAmount = parseFloat((actualAmount * parseFloat(feeRate.toString())).toFixed(2));

        await prisma.$transaction([
          // 更新订单
          prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'PAID',
              thirdTradeNo: trade_no,
              actualAmount,
              feeAmount,
              paidAt: new Date(),
              notifiedAt: new Date(),
              notifyCount: { increment: 1 },
            },
          }),
          // 更新商户余额
          prisma.merchant.update({
            where: { id: order.merchantId },
            data: {
              balance: { increment: actualAmount - feeAmount },
              totalIncome: { increment: actualAmount },
            },
          }),
        ]);

        logger.info('支付宝支付成功:', { orderNo: out_trade_no, amount: actualAmount });

        // 异步通知商户
        if (order.notifyUrl) {
          notifyMerchant(order.notifyUrl, {
            orderNo: order.orderNo,
            outTradeNo: order.outTradeNo,
            status: 'PAID',
            amount: actualAmount,
            paidAt: new Date().toISOString(),
          });
        }
      }
    } else if (trade_status === 'TRADE_CLOSED') {
      if (order.status === 'PENDING') {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
      }
    }

    res.send('success');
  } catch (err) {
    logger.error('处理支付宝回调异常:', err);
    res.send('fail');
  }
});

/**
 * 微信支付异步回调
 */
notifyRouter.post('/wechat', async (req: Request, res: Response) => {
  try {
    let xmlBody = '';
    req.on('data', (chunk) => (xmlBody += chunk));
    req.on('end', async () => {
      try {
        logger.info('收到微信支付回调');

        const params = await verifyWechatNotify(xmlBody);
        if (!params) {
          return res.send(`<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[签名验证失败]]></return_msg></xml>`);
        }

        const { out_trade_no, transaction_id, result_code, total_fee } = params;

        if (result_code === 'SUCCESS') {
          const order = await prisma.order.findFirst({
            where: { orderNo: out_trade_no },
          });

          if (order && order.status === 'PENDING') {
            const merchant = await prisma.merchant.findUnique({ where: { id: order.merchantId } });
            const feeRate = merchant?.feeRate || 0;
            const actualAmount = parseInt(total_fee) / 100;
            const feeAmount = parseFloat((actualAmount * parseFloat(feeRate.toString())).toFixed(2));

            await prisma.$transaction([
              prisma.order.update({
                where: { id: order.id },
                data: {
                  status: 'PAID',
                  thirdTradeNo: transaction_id,
                  actualAmount,
                  feeAmount,
                  paidAt: new Date(),
                  notifiedAt: new Date(),
                  notifyCount: { increment: 1 },
                },
              }),
              prisma.merchant.update({
                where: { id: order.merchantId },
                data: {
                  balance: { increment: actualAmount - feeAmount },
                  totalIncome: { increment: actualAmount },
                },
              }),
            ]);

            logger.info('微信支付成功:', { orderNo: out_trade_no, amount: actualAmount });

            if (order.notifyUrl) {
              notifyMerchant(order.notifyUrl, {
                orderNo: order.orderNo,
                outTradeNo: order.outTradeNo,
                status: 'PAID',
                amount: actualAmount,
                paidAt: new Date().toISOString(),
              });
            }
          }
        }

        res.send(`<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>`);
      } catch (err) {
        logger.error('处理微信回调异常:', err);
        res.send(`<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[处理失败]]></return_msg></xml>`);
      }
    });
  } catch (err) {
    logger.error('微信回调异常:', err);
    res.send(`<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[系统错误]]></return_msg></xml>`);
  }
});

/**
 * 异步通知商户
 */
async function notifyMerchant(url: string, data: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await axios.post(url, data, { timeout: 5000 });
      logger.info('商户通知成功:', url);
      return;
    } catch (err) {
      logger.warn(`商户通知失败 (${i + 1}/${retries}):`, url);
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, (i + 1) * 2000));
      }
    }
  }
}
