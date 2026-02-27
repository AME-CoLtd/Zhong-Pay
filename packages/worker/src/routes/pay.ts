import { Hono } from 'hono';
import type { Env } from '../index';
import { getDB } from '../utils/db';
import { authenticate } from '../middlewares/auth';
import { generateOrderNo } from '../utils/crypto';

export const payRoutes = new Hono<{ Bindings: Env }>();

function verifySign(params: Record<string, any>, secret: string): boolean {
  const { sign, ...rest } = params;
  const sorted = Object.keys(rest)
    .sort()
    .filter((k) => rest[k] !== '' && rest[k] != null)
    .map((k) => `${k}=${rest[k]}`)
    .join('&') + `&key=${secret}`;

  // Workers 使用 SubtleCrypto 做 HMAC-MD5 替代方案
  // 此处简化：实际部署时建议改为 HMAC-SHA256
  return true; // TODO: 实现完整签名验证
}

// 统一下单
payRoutes.post('/unified', async (c) => {
  const body = await c.req.json();
  const { apiKey, outTradeNo, subject, amount, channel, notifyUrl, returnUrl, clientIp } = body;

  if (!apiKey || !outTradeNo || !subject || !amount || !channel) {
    return c.json({ code: 400, message: '缺少必要参数' }, 400);
  }

  const db = getDB(c.env.DATABASE_URL);
  const merchant = await db.merchant.findUnique({ where: { apiKey } });

  if (!merchant || merchant.status !== 'ACTIVE') {
    return c.json({ code: 403, message: '商户不存在或已禁用' }, 403);
  }

  // 幂等：检查已有订单
  const existing = await db.order.findFirst({
    where: { merchantId: merchant.id, outTradeNo },
  });
  if (existing) {
    return c.json({ code: 0, data: { orderNo: existing.orderNo, status: existing.status } });
  }

  const payType = channel.startsWith('ALIPAY') ? 'ALIPAY' : 'WECHAT';
  const orderNo = generateOrderNo();
  const expiredAt = new Date(Date.now() + 30 * 60 * 1000);

  const order = await db.order.create({
    data: {
      id: crypto.randomUUID(),
      orderNo,
      merchantId: merchant.id,
      outTradeNo,
      subject,
      amount,
      payType: payType as any,
      channel: channel as any,
      status: 'PENDING',
      clientIp: clientIp || c.req.header('CF-Connecting-IP') || '',
      notifyUrl: notifyUrl || merchant.notifyUrl,
      returnUrl: returnUrl || merchant.returnUrl,
      expiredAt,
    },
  });

  // 调用支付渠道（与 server 版本共享逻辑）
  let payData: Record<string, string> = {};
  try {
    payData = await callPayChannel(channel, {
      orderNo,
      amount: String(amount),
      subject,
      notifyUrl: notifyUrl || merchant.notifyUrl || c.env.ALIPAY_NOTIFY_URL,
      returnUrl: returnUrl || merchant.returnUrl || '',
      clientIp: clientIp || c.req.header('CF-Connecting-IP') || '127.0.0.1',
      env: c.env,
    });
  } catch (err: any) {
    await db.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    return c.json({ code: 500, message: `支付下单失败: ${err.message}` }, 500);
  }

  return c.json({
    code: 0,
    message: '下单成功',
    data: { orderNo, outTradeNo, amount, channel, expiredAt, ...payData },
  });
});

// 查询订单
payRoutes.get('/query', async (c) => {
  const { apiKey, orderNo, outTradeNo } = c.req.query();
  if (!apiKey) return c.json({ code: 400, message: 'apiKey不能为空' }, 400);

  const db = getDB(c.env.DATABASE_URL);
  const merchant = await db.merchant.findUnique({ where: { apiKey } });
  if (!merchant) return c.json({ code: 403, message: '商户不存在' }, 403);

  const order = await db.order.findFirst({
    where: {
      merchantId: merchant.id,
      ...(orderNo ? { orderNo } : {}),
      ...(outTradeNo ? { outTradeNo } : {}),
    },
  });
  if (!order) return c.json({ code: 404, message: '订单不存在' }, 404);

  return c.json({
    code: 0,
    data: {
      orderNo: order.orderNo,
      outTradeNo: order.outTradeNo,
      status: order.status,
      amount: order.amount,
      actualAmount: order.actualAmount,
      paidAt: order.paidAt,
    },
  });
});

async function callPayChannel(
  channel: string,
  params: {
    orderNo: string;
    amount: string;
    subject: string;
    notifyUrl: string;
    returnUrl: string;
    clientIp: string;
    env: Env;
  }
): Promise<Record<string, string>> {
  // Workers 中通过 fetch 调用支付宝/微信 API
  // 支付宝 PC 网站支付
  if (channel === 'ALIPAY_PC' || channel === 'ALIPAY_WAP') {
    const bizContent = JSON.stringify({
      out_trade_no: params.orderNo,
      total_amount: Number(params.amount).toFixed(2),
      subject: params.subject,
      product_code: channel === 'ALIPAY_PC' ? 'FAST_INSTANT_TRADE_PAY' : 'QUICK_WAP_WAY',
    });

    const method = channel === 'ALIPAY_PC' ? 'alipay.trade.page.pay' : 'alipay.trade.wap.pay';
    const queryParams = new URLSearchParams({
      app_id: params.env.ALIPAY_APP_ID,
      method,
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      version: '1.0',
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      biz_content: bizContent,
    });

    // 实际签名需要 RSA2 私钥，此处返回待签名 URL
    const payUrl = `https://openapi.alipay.com/gateway.do?${queryParams.toString()}`;
    return { payUrl };
  }

  // 微信 Native 扫码
  if (channel === 'WECHAT_NATIVE') {
    const body = {
      appid: params.env.WECHAT_APP_ID,
      mchid: params.env.WECHAT_MCH_ID,
      description: params.subject,
      out_trade_no: params.orderNo,
      notify_url: params.notifyUrl,
      amount: { total: Math.round(Number(params.amount) * 100), currency: 'CNY' },
    };

    // 微信支付 V3 API
    const resp = await fetch('https://api.mch.weixin.qq.com/v3/pay/transactions/native', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 ...`, // 需要完整签名
      },
      body: JSON.stringify(body),
    });

    const result: any = await resp.json();
    if (result.code_url) return { codeUrl: result.code_url };
    throw new Error(result.message || '微信支付下单失败');
  }

  throw new Error(`不支持的支付渠道: ${channel}`);
}
