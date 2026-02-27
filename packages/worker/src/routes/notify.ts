import { Hono } from 'hono';
import type { Env } from '../index';
import { getDB } from '../utils/db';

export const notifyRoutes = new Hono<{ Bindings: Env }>();

// 支付宝回调
notifyRoutes.post('/alipay', async (c) => {
  try {
    const formData = await c.req.formData();
    const params: Record<string, string> = {};
    formData.forEach((v, k) => { params[k] = String(v); });

    const { out_trade_no, trade_no, trade_status, total_amount } = params;
    console.log('支付宝回调:', { out_trade_no, trade_status });

    // TODO: 验证支付宝签名（RSA2）
    const db = getDB(c.env.DATABASE_URL);
    const order = await db.order.findFirst({ where: { orderNo: out_trade_no } });

    if (order && order.status === 'PENDING' &&
      (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED')) {
      const merchant = await db.merchant.findUnique({ where: { id: order.merchantId } });
      const actualAmount = parseFloat(total_amount);
      const feeRate = Number(merchant?.feeRate || 0);
      const feeAmount = parseFloat((actualAmount * feeRate).toFixed(2));

      await db.$transaction([
        db.order.update({
          where: { id: order.id },
          data: { status: 'PAID', thirdTradeNo: trade_no, actualAmount, feeAmount, paidAt: new Date(), notifiedAt: new Date(), notifyCount: { increment: 1 } },
        }),
        db.merchant.update({
          where: { id: order.merchantId },
          data: { balance: { increment: actualAmount - feeAmount }, totalIncome: { increment: actualAmount } },
        }),
      ]);

      // 异步通知商户
      if (order.notifyUrl) {
        c.executionCtx.waitUntil(
          fetch(order.notifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderNo: order.orderNo, outTradeNo: order.outTradeNo, status: 'PAID', amount: actualAmount }),
          }).catch(console.error)
        );
      }
    }

    return c.text('success');
  } catch (err) {
    console.error('支付宝回调异常:', err);
    return c.text('fail');
  }
});

// 微信回调
notifyRoutes.post('/wechat', async (c) => {
  try {
    const xml = await c.req.text();
    console.log('微信支付回调');

    // 简单解析 XML（Workers 中无 xml2js，手动解析）
    const get = (tag: string) => xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]><\/${tag}>`))?.[1] ||
      xml.match(new RegExp(`<${tag}>(.+?)<\/${tag}>`))?.[1] || '';

    const resultCode = get('result_code');
    const outTradeNo = get('out_trade_no');
    const transactionId = get('transaction_id');
    const totalFee = get('total_fee');

    if (resultCode === 'SUCCESS' && outTradeNo) {
      const db = getDB(c.env.DATABASE_URL);
      const order = await db.order.findFirst({ where: { orderNo: outTradeNo } });

      if (order && order.status === 'PENDING') {
        const actualAmount = parseInt(totalFee) / 100;
        const feeRate = Number((await db.merchant.findUnique({ where: { id: order.merchantId } }))?.feeRate || 0);
        const feeAmount = parseFloat((actualAmount * feeRate).toFixed(2));

        await db.$transaction([
          db.order.update({
            where: { id: order.id },
            data: { status: 'PAID', thirdTradeNo: transactionId, actualAmount, feeAmount, paidAt: new Date(), notifiedAt: new Date(), notifyCount: { increment: 1 } },
          }),
          db.merchant.update({
            where: { id: order.merchantId },
            data: { balance: { increment: actualAmount - feeAmount }, totalIncome: { increment: actualAmount } },
          }),
        ]);

        if (order.notifyUrl) {
          c.executionCtx.waitUntil(
            fetch(order.notifyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderNo: order.orderNo, outTradeNo: order.outTradeNo, status: 'PAID', amount: actualAmount }),
            }).catch(console.error)
          );
        }
      }
    }

    return c.text('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>', 200, { 'Content-Type': 'text/xml' });
  } catch (err) {
    console.error('微信回调异常:', err);
    return c.text('<xml><return_code><![CDATA[FAIL]]></return_code></xml>', 200, { 'Content-Type': 'text/xml' });
  }
});
