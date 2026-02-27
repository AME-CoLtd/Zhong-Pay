import dayjs from 'dayjs';

/**
 * 生成订单号: ZP + 时间戳 + 随机4位
 */
export function generateOrderNo(): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `ZP${timestamp}${random}`;
}

/**
 * 生成退款号
 */
export function generateRefundNo(): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `RF${timestamp}${random}`;
}

/**
 * 生成提现号
 */
export function generateWithdrawNo(): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `WD${timestamp}${random}`;
}

/**
 * 生成结算号
 */
export function generateSettleNo(): string {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `ST${timestamp}${random}`;
}

/**
 * 脱敏处理
 */
export function maskString(str: string, start: number, end: number): string {
  if (!str || str.length <= start + end) return str;
  return str.slice(0, start) + '*'.repeat(str.length - start - end) + str.slice(-end);
}

/**
 * 格式化金额（分转元）
 */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

/**
 * 金额（元转分）
 */
export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100);
}

/**
 * 验证IP地址
 */
export function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;
  const parts = ip.split('.');
  return parts.every((part) => parseInt(part) <= 255);
}
