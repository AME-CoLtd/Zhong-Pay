import https from 'https';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import xml2js from 'xml2js';
import { logger } from '../utils/logger';

const WECHAT_API = 'https://api.mch.weixin.qq.com';

/**
 * 生成微信支付签名
 */
function sign(params: Record<string, string | number>, apiKey: string): string {
  const sortedKeys = Object.keys(params).sort();
  const str = sortedKeys
    .filter((key) => params[key] !== '' && params[key] !== undefined)
    .map((key) => `${key}=${params[key]}`)
    .join('&') + `&key=${apiKey}`;
  return crypto.createHash('md5').update(str, 'utf8').digest('hex').toUpperCase();
}

/**
 * 对象转XML
 */
function toXml(obj: Record<string, any>): string {
  let xml = '<xml>';
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && /[<>&'"]/.test(value)) {
      xml += `<${key}><![CDATA[${value}]]></${key}>`;
    } else {
      xml += `<${key}>${value}</${key}>`;
    }
  }
  xml += '</xml>';
  return xml;
}

/**
 * XML转对象
 */
async function fromXml(xml: string): Promise<Record<string, string>> {
  const result = await xml2js.parseStringPromise(xml, { explicitArray: false });
  return result.xml;
}

/**
 * 发送HTTP请求
 */
function post(url: string, data: string, options?: https.RequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', ...options }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * 生成随机字符串
 */
function nonceStr(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * 微信 Native 扫码支付
 */
export async function wechatNativePay(params: {
  orderNo: string;
  amount: number; // 单位：分
  subject: string;
  clientIp: string;
  notifyUrl?: string;
}): Promise<string> {
  const appId = process.env.WECHAT_APP_ID!;
  const mchId = process.env.WECHAT_MCH_ID!;
  const apiKey = process.env.WECHAT_API_KEY!;

  const reqParams: Record<string, string | number> = {
    appid: appId,
    mch_id: mchId,
    nonce_str: nonceStr(),
    body: params.subject,
    out_trade_no: params.orderNo,
    total_fee: params.amount,
    spbill_create_ip: params.clientIp,
    notify_url: params.notifyUrl || process.env.WECHAT_NOTIFY_URL!,
    trade_type: 'NATIVE',
  };

  reqParams.sign = sign(reqParams, apiKey);

  const xml = toXml(reqParams);
  const responseXml = await post(`${WECHAT_API}/pay/unifiedorder`, xml);
  const response = await fromXml(responseXml);

  if (response.return_code !== 'SUCCESS') {
    throw new Error(`微信支付请求失败: ${response.return_msg}`);
  }
  if (response.result_code !== 'SUCCESS') {
    throw new Error(`微信支付下单失败: ${response.err_code_des}`);
  }

  return response.code_url; // 用于生成二维码的URL
}

/**
 * 微信H5支付
 */
export async function wechatH5Pay(params: {
  orderNo: string;
  amount: number;
  subject: string;
  clientIp: string;
  notifyUrl?: string;
}): Promise<string> {
  const appId = process.env.WECHAT_APP_ID!;
  const mchId = process.env.WECHAT_MCH_ID!;
  const apiKey = process.env.WECHAT_API_KEY!;

  const reqParams: Record<string, string | number> = {
    appid: appId,
    mch_id: mchId,
    nonce_str: nonceStr(),
    body: params.subject,
    out_trade_no: params.orderNo,
    total_fee: params.amount,
    spbill_create_ip: params.clientIp,
    notify_url: params.notifyUrl || process.env.WECHAT_NOTIFY_URL!,
    trade_type: 'MWEB',
    scene_info: JSON.stringify({ h5_info: { type: 'Wap', wap_url: process.env.PLATFORM_URL, wap_name: '在线支付' } }),
  };

  reqParams.sign = sign(reqParams, apiKey);

  const xml = toXml(reqParams);
  const responseXml = await post(`${WECHAT_API}/pay/unifiedorder`, xml);
  const response = await fromXml(responseXml);

  if (response.return_code !== 'SUCCESS' || response.result_code !== 'SUCCESS') {
    throw new Error(`微信H5支付失败: ${response.err_code_des || response.return_msg}`);
  }

  return response.mweb_url;
}

/**
 * 验证微信回调签名
 */
export async function verifyWechatNotify(xmlBody: string): Promise<Record<string, string> | null> {
  try {
    const params = await fromXml(xmlBody);
    const { sign: receivedSign, ...rest } = params;
    const expectedSign = sign(rest, process.env.WECHAT_API_KEY!);

    if (receivedSign !== expectedSign) {
      logger.warn('微信回调签名验证失败');
      return null;
    }
    return params;
  } catch (err) {
    logger.error('微信回调解析失败:', err);
    return null;
  }
}

/**
 * 微信支付退款
 */
export async function wechatRefund(params: {
  orderNo: string;
  refundNo: string;
  totalAmount: number;
  refundAmount: number;
  reason?: string;
}): Promise<boolean> {
  const appId = process.env.WECHAT_APP_ID!;
  const mchId = process.env.WECHAT_MCH_ID!;
  const apiKey = process.env.WECHAT_API_KEY!;

  const reqParams: Record<string, string | number> = {
    appid: appId,
    mch_id: mchId,
    nonce_str: nonceStr(),
    out_trade_no: params.orderNo,
    out_refund_no: params.refundNo,
    total_fee: params.totalAmount,
    refund_fee: params.refundAmount,
    refund_desc: params.reason || '商户退款',
  };

  reqParams.sign = sign(reqParams, apiKey);

  // 退款接口需要双向证书
  const certPath = process.env.WECHAT_CERT_PATH;
  const keyPath = process.env.WECHAT_KEY_PATH;

  let sslOptions = {};
  if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    sslOptions = {
      pfx: fs.readFileSync(certPath),
      passphrase: mchId,
    };
  }

  const xml = toXml(reqParams);
  const responseXml = await post(`${WECHAT_API}/secapi/pay/refund`, xml, sslOptions);
  const response = await fromXml(responseXml);

  if (response.return_code !== 'SUCCESS' || response.result_code !== 'SUCCESS') {
    throw new Error(`微信退款失败: ${response.err_code_des || response.return_msg}`);
  }
  return true;
}
