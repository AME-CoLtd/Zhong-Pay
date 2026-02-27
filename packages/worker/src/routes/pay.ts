import { Hono } from 'hono';
import type { Env } from '../index';
import { findMerchantByApiKey, findOrderByNo, createOrder, updateOrderStatus } from '../utils/db';
import { generateOrderNo } from '../utils/crypto';

export const payRoutes = new Hono<{ Bindings: Env }>();

// 统一下单
payRoutes.post('/unified', async (c) => {
  const body = await c.req.json();
  const { apiKey, outTradeNo, subject, amount, channel, notifyUrl, returnUrl, clientIp } = body;

  if (!apiKey || !outTradeNo || !subject || !amount || !channel)
    return c.json({ code: 400, message: '缺少必要参数' }, 400);

  const merchant = await findMerchantByApiKey(c.env.DB, apiKey);
  if (!merchant || merchant.status !== 'ACTIVE')
    return c.json({ code: 403, message: '商户不存在或已禁用' }, 403);

  // 幂等：检查已有订单
  const existing = await c.env.DB
    .prepare('SELECT order_no, status FROM orders WHERE merchant_id=? AND out_trade_no=?')
    .bind(merchant.id, outTradeNo).first<any>();
  if (existing)
    return c.json({ code: 0, data: { orderNo: existing.order_no, status: existing.status } });

  const payType  = channel.startsWith('ALIPAY') ? 'ALIPAY' : 'WECHAT';
  const orderNo  = generateOrderNo();
  const expiredAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const id       = crypto.randomUUID();

  await createOrder(c.env.DB, {
    id, orderNo, merchantId: merchant.id, outTradeNo, subject, amount,
    payType, channel,
    clientIp: clientIp || c.req.header('CF-Connecting-IP') || '',
    notifyUrl: notifyUrl || merchant.notify_url || '',
    returnUrl: returnUrl || merchant.return_url || '',
    expiredAt,
  });

  let payData: Record<string, string> = {};
  try {
    payData = await callPayChannel(channel, {
      orderNo, amount: String(amount), subject,
      notifyUrl: notifyUrl || merchant.notify_url || c.env.ALIPAY_NOTIFY_URL,
      returnUrl: returnUrl || merchant.return_url || '',
      clientIp: clientIp || c.req.header('CF-Connecting-IP') || '127.0.0.1',
      env: c.env,
    });
  } catch (err: any) {
    await updateOrderStatus(c.env.DB, orderNo, 'FAILED');
    return c.json({ code: 500, message: `支付下单失败: ${err.message}` }, 500);
  }

  return c.json({
    code: 0, message: '下单成功',
    data: { orderNo, outTradeNo, amount, channel, expiredAt, ...payData },
  });
});

// 查询订单
payRoutes.get('/query', async (c) => {
  const { apiKey, orderNo } = c.req.query();
  if (!apiKey || !orderNo) return c.json({ code: 400, message: 'apiKey和orderNo不能为空' }, 400);

  const merchant = await findMerchantByApiKey(c.env.DB, apiKey);
  if (!merchant) return c.json({ code: 403, message: '商户不存在' }, 403);

  const order = await findOrderByNo(c.env.DB, orderNo);
  if (!order || order.merchant_id !== merchant.id)
    return c.json({ code: 404, message: '订单不存在' }, 404);

  return c.json({
    code: 0,
    data: {
      orderNo: order.order_no, outTradeNo: order.out_trade_no,
      status: order.status, amount: order.amount,
      actualAmount: order.actual_amount, paidAt: order.paid_at,
    },
  });
});

async function callPayChannel(
  channel: string,
  params: { orderNo: string; amount: string; subject: string; notifyUrl: string; returnUrl: string; clientIp: string; env: Env }
): Promise<Record<string, string>> {
  if (channel === 'ALIPAY_PC' || channel === 'ALIPAY_WAP') {
    const bizContent = JSON.stringify({
      out_trade_no: params.orderNo,
      total_amount: Number(params.amount).toFixed(2),
      subject: params.subject,
      product_code: channel === 'ALIPAY_PC' ? 'FAST_INSTANT_TRADE_PAY' : 'QUICK_WAP_WAY',
    });
    const method = channel === 'ALIPAY_PC' ? 'alipay.trade.page.pay' : 'alipay.trade.wap.pay';
    const queryParams = new URLSearchParams({
      app_id: params.env.ALIPAY_APP_ID, method, charset: 'utf-8', sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0', notify_url: params.notifyUrl, return_url: params.returnUrl,
      biz_content: bizContent,
    });
    return { payUrl: `https://openapi.alipay.com/gateway.do?${queryParams.toString()}` };
  }

  if (channel === 'WECHAT_NATIVE') {
    const resp = await fetch('https://api.mch.weixin.qq.com/v3/pay/transactions/native', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${params.env.WECHAT_MCH_ID}"` },
      body: JSON.stringify({
        appid: params.env.WECHAT_APP_ID, mchid: params.env.WECHAT_MCH_ID,
        description: params.subject, out_trade_no: params.orderNo, notify_url: params.notifyUrl,
        amount: { total: Math.round(Number(params.amount) * 100), currency: 'CNY' },
      }),
    });
    const result: any = await resp.json();
    if (result.code_url) return { codeUrl: result.code_url };
    throw new Error(result.message || '微信支付下单失败');
  }

  throw new Error(`不支持的支付渠道: ${channel}`);
}
