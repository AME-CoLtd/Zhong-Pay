import { Hono } from 'hono';
import type { Env } from '../index';
import { findOrderByNo, findMerchantById, updateOrderPaid } from '../utils/db';

export const notifyRoutes = new Hono<{ Bindings: Env }>();

// 支付宝回调
notifyRoutes.post('/alipay', async (c) => {
  try {
    const formData = await c.req.formData();
    const params: Record<string, string> = {};
    formData.forEach((v, k) => { params[k] = String(v); });
    const { out_trade_no, trade_no, trade_status, total_amount } = params;

    if (trade_status === 'TRADE_SUCCESS' || trade_status === 'TRADE_FINISHED') {
      const order = await findOrderByNo(c.env.DB, out_trade_no);
      if (order && order.status === 'PENDING') {
        const merchant    = await findMerchantById(c.env.DB, order.merchant_id);
        const actualAmount = parseFloat(total_amount);
        const feeAmount   = parseFloat((actualAmount * (merchant?.fee_rate ?? 0)).toFixed(2));
        await updateOrderPaid(c.env.DB, out_trade_no, trade_no, actualAmount, feeAmount);
        // 异步通知商户
        if (order.notify_url) {
          c.executionCtx.waitUntil(
            fetch(order.notify_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderNo: order.order_no, outTradeNo: order.out_trade_no, status: 'PAID', amount: actualAmount }),
            }).catch(console.error)
          );
        }
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
    const xml       = await c.req.text();
    const get       = (tag: string) =>
      xml.match(new RegExp(`<${tag}><!\\[CDATA\\[(.+?)\\]\\]></${tag}>`))?.[1] ||
      xml.match(new RegExp(`<${tag}>(.+?)</${tag}>`))?.[1] || '';
    const resultCode    = get('result_code');
    const outTradeNo    = get('out_trade_no');
    const transactionId = get('transaction_id');
    const totalFee      = get('total_fee');

    if (resultCode === 'SUCCESS' && outTradeNo) {
      const order = await findOrderByNo(c.env.DB, outTradeNo);
      if (order && order.status === 'PENDING') {
        const merchant     = await findMerchantById(c.env.DB, order.merchant_id);
        const actualAmount = parseInt(totalFee) / 100;
        const feeAmount    = parseFloat((actualAmount * (merchant?.fee_rate ?? 0)).toFixed(2));
        await updateOrderPaid(c.env.DB, outTradeNo, transactionId, actualAmount, feeAmount);
        if (order.notify_url) {
          c.executionCtx.waitUntil(
            fetch(order.notify_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderNo: order.order_no, outTradeNo: order.out_trade_no, status: 'PAID', amount: actualAmount }),
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
