import AlipaySdk from 'alipay-sdk';
import { logger } from '../utils/logger';

let alipaySdkInstance: AlipaySdk | null = null;

export function getAlipaySDK(): AlipaySdk {
  if (!alipaySdkInstance) {
    alipaySdkInstance = new AlipaySdk({
      appId: process.env.ALIPAY_APP_ID!,
      privateKey: process.env.ALIPAY_PRIVATE_KEY!,
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY!,
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
      charset: 'utf-8',
      version: '1.0',
    });
  }
  return alipaySdkInstance;
}

/**
 * 支付宝电脑网站支付
 */
export async function alipayPagePay(params: {
  orderNo: string;
  amount: string;
  subject: string;
  body?: string;
  returnUrl?: string;
  notifyUrl?: string;
  expiredTime?: string;
}): Promise<string> {
  const sdk = getAlipaySDK();
  const formData: any = {
    method: 'alipay.trade.page.pay',
    bizContent: {
      out_trade_no: params.orderNo,
      total_amount: params.amount,
      subject: params.subject,
      body: params.body || params.subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      time_expire: params.expiredTime,
    },
    returnUrl: params.returnUrl,
    notifyUrl: params.notifyUrl || process.env.ALIPAY_NOTIFY_URL,
  };

  const result = await sdk.pageExec('alipay.trade.page.pay', { method: 'GET', ...formData });
  return result;
}

/**
 * 支付宝手机网站支付
 */
export async function alipayWapPay(params: {
  orderNo: string;
  amount: string;
  subject: string;
  returnUrl?: string;
  notifyUrl?: string;
}): Promise<string> {
  const sdk = getAlipaySDK();
  const result = await sdk.pageExec('alipay.trade.wap.pay', {
    method: 'GET',
    bizContent: {
      out_trade_no: params.orderNo,
      total_amount: params.amount,
      subject: params.subject,
      product_code: 'QUICK_WAP_WAY',
    },
    returnUrl: params.returnUrl,
    notifyUrl: params.notifyUrl || process.env.ALIPAY_NOTIFY_URL,
  });
  return result;
}

/**
 * 支付宝扫码支付
 */
export async function alipayQrcode(params: {
  orderNo: string;
  amount: string;
  subject: string;
  notifyUrl?: string;
}): Promise<string> {
  const sdk = getAlipaySDK();
  const result = await sdk.exec('alipay.trade.precreate', {
    bizContent: {
      out_trade_no: params.orderNo,
      total_amount: params.amount,
      subject: params.subject,
    },
    notifyUrl: params.notifyUrl || process.env.ALIPAY_NOTIFY_URL,
  });

  const response = result as any;
  if (response.code !== '10000') {
    throw new Error(`支付宝扫码支付失败: ${response.subMsg || response.msg}`);
  }
  return response.qrCode;
}

/**
 * 验证支付宝回调签名
 */
export function verifyAlipayNotify(params: Record<string, string>): boolean {
  try {
    const sdk = getAlipaySDK();
    return sdk.checkNotifySign(params);
  } catch (err) {
    logger.error('支付宝回调验签失败:', err);
    return false;
  }
}

/**
 * 支付宝退款
 */
export async function alipayRefund(params: {
  orderNo: string;
  refundNo: string;
  amount: string;
  reason?: string;
}): Promise<boolean> {
  const sdk = getAlipaySDK();
  const result = await sdk.exec('alipay.trade.refund', {
    bizContent: {
      out_trade_no: params.orderNo,
      refund_amount: params.amount,
      refund_reason: params.reason || '商户退款',
      out_request_no: params.refundNo,
    },
  }) as any;

  if (result.code !== '10000') {
    throw new Error(`支付宝退款失败: ${result.subMsg || result.msg}`);
  }
  return true;
}
