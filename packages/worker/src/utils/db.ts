/**
 * D1 数据库工具函数
 * 封装常用 CRUD，替代 Prisma（Workers 环境原生 D1）
 */

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}
interface D1ExecResult {
  count: number;
  duration: number;
}

// ── Admin ──────────────────────────────────────────────
export async function findAdminByUsername(db: D1Database, username: string) {
  return db.prepare('SELECT * FROM admins WHERE username = ?').bind(username).first<any>();
}

export async function findAdminById(db: D1Database, id: string) {
  return db.prepare(
    'SELECT id,username,email,phone,role,is_active,last_login,created_at FROM admins WHERE id = ?'
  ).bind(id).first<any>();
}

export async function updateAdminLastLogin(db: D1Database, id: string) {
  return db.prepare(
    "UPDATE admins SET last_login = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();
}

export async function updateAdminPassword(db: D1Database, id: string, password: string) {
  return db.prepare(
    "UPDATE admins SET password = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(password, id).run();
}

export async function updateAdminEmail(db: D1Database, id: string, email: string) {
  return db.prepare(
    "UPDATE admins SET email = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(email, id).run();
}

export async function updateAdminPhone(db: D1Database, id: string, phone: string) {
  return db.prepare(
    "UPDATE admins SET phone = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(phone, id).run();
}

export async function listAdmins(db: D1Database, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [list, total] = await Promise.all([
    db.prepare(`
      SELECT id,username,email,phone,role,is_active,last_login,created_at
      FROM admins
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(pageSize, offset).all<any>(),
    db.prepare('SELECT COUNT(*) as count FROM admins').first<{ count: number }>(),
  ]);
  return { list: list.results ?? [], total: total?.count ?? 0 };
}

export async function createAdmin(db: D1Database, data: {
  id: string;
  username: string;
  password: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  isActive?: number;
}) {
  return db.prepare(`
    INSERT INTO admins (id, username, password, email, phone, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.id,
    data.username,
    data.password,
    data.email ?? null,
    data.phone ?? null,
    data.role ?? 'STAFF',
    data.isActive ?? 1
  ).run();
}

export async function updateAdmin(db: D1Database, id: string, data: {
  email?: string | null;
  phone?: string | null;
  role?: string;
  isActive?: number;
}) {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
  if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone); }
  if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive); }

  if (!fields.length) return;

  values.push(id);
  return db.prepare(
    `UPDATE admins SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values).run();
}

// ── Merchant ───────────────────────────────────────────
export async function listMerchants(db: D1Database, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const [list, total] = await Promise.all([
    db.prepare('SELECT * FROM merchants ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(pageSize, offset).all<any>(),
    db.prepare('SELECT COUNT(*) as count FROM merchants').first<{ count: number }>(),
  ]);
  return { list: list.results ?? [], total: total?.count ?? 0 };
}

export async function findMerchantById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM merchants WHERE id = ?').bind(id).first<any>();
}

export async function findMerchantByApiKey(db: D1Database, apiKey: string) {
  return db.prepare('SELECT * FROM merchants WHERE api_key = ?').bind(apiKey).first<any>();
}

export async function createMerchant(db: D1Database, data: Record<string, unknown>) {
  return db.prepare(`
    INSERT INTO merchants (id,name,email,phone,api_key,api_secret,notify_url,return_url,fee_rate,status)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    data.id, data.name, data.email, data.phone ?? null,
    data.apiKey, data.apiSecret, data.notifyUrl ?? null,
    data.returnUrl ?? null, data.feeRate ?? 0.006, data.status ?? 'ACTIVE'
  ).run();
}

export async function updateMerchant(db: D1Database, id: string, data: Record<string, unknown>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  const allowed = ['name','email','phone','notify_url','return_url','fee_rate','status','remark'];
  const keyMap: Record<string, string> = {
    name: 'name', email: 'email', phone: 'phone',
    notifyUrl: 'notify_url', returnUrl: 'return_url',
    feeRate: 'fee_rate', status: 'status', remark: 'remark',
  };
  for (const [k, col] of Object.entries(keyMap)) {
    if (data[k] !== undefined) { fields.push(`${col} = ?`); values.push(data[k]); }
  }
  if (!fields.length) return;
  values.push(id);
  return db.prepare(
    `UPDATE merchants SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...values).run();
}

export async function resetMerchantKey(db: D1Database, id: string, apiKey: string, apiSecret: string) {
  return db.prepare(
    "UPDATE merchants SET api_key=?, api_secret=?, updated_at=datetime('now') WHERE id=?"
  ).bind(apiKey, apiSecret, id).run();
}

// ── Order ──────────────────────────────────────────────
export async function listOrders(db: D1Database, opts: {
  page?: number; pageSize?: number; merchantId?: string;
  status?: string; payType?: string; keyword?: string;
  startDate?: string; endDate?: string;
}) {
  const { page = 1, pageSize = 20, merchantId, status, payType, keyword, startDate, endDate } = opts;
  const where: string[] = [];
  const params: unknown[] = [];
  if (merchantId) { where.push('merchant_id = ?'); params.push(merchantId); }
  if (status)     { where.push('status = ?');      params.push(status); }
  if (payType)    { where.push('pay_type = ?');    params.push(payType); }
  if (keyword)    { where.push("(order_no LIKE ? OR out_trade_no LIKE ?)"); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (startDate)  { where.push('created_at >= ?'); params.push(startDate); }
  if (endDate)    { where.push('created_at <= ?'); params.push(endDate); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [list, total] = await Promise.all([
    db.prepare(`SELECT * FROM orders ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, offset).all<any>(),
    db.prepare(`SELECT COUNT(*) as count FROM orders ${w}`).bind(...params).first<{ count: number }>(),
  ]);
  return { list: list.results ?? [], total: total?.count ?? 0 };
}

export async function findOrderByNo(db: D1Database, orderNo: string) {
  return db.prepare('SELECT * FROM orders WHERE order_no = ?').bind(orderNo).first<any>();
}

export async function findOrderById(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>();
}

export async function createOrder(db: D1Database, data: Record<string, unknown>) {
  return db.prepare(`
    INSERT INTO orders
      (id,order_no,merchant_id,out_trade_no,subject,body,amount,currency,pay_type,channel,status,
       client_ip,notify_url,return_url,expired_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    data.id, data.orderNo, data.merchantId, data.outTradeNo, data.subject,
    data.body ?? null, data.amount, data.currency ?? 'CNY',
    data.payType, data.channel, 'PENDING', data.clientIp ?? null,
    data.notifyUrl ?? null, data.returnUrl ?? null, data.expiredAt ?? null
  ).run();
}

export async function updateOrderPaid(db: D1Database, orderNo: string, thirdTradeNo: string, actualAmount: number, feeAmount: number) {
  return db.prepare(`
    UPDATE orders SET status='PAID', third_trade_no=?, actual_amount=?, fee_amount=?,
    paid_at=datetime('now'), updated_at=datetime('now') WHERE order_no=?
  `).bind(thirdTradeNo, actualAmount, feeAmount, orderNo).run();
}

export async function updateOrderStatus(db: D1Database, orderNo: string, status: string) {
  return db.prepare(
    "UPDATE orders SET status=?, updated_at=datetime('now') WHERE order_no=?"
  ).bind(status, orderNo).run();
}

// ── Withdrawal ─────────────────────────────────────────
export async function listWithdrawals(db: D1Database, opts: { page?: number; pageSize?: number; merchantId?: string; status?: string }) {
  const { page = 1, pageSize = 20, merchantId, status } = opts;
  const where: string[] = [];
  const params: unknown[] = [];
  if (merchantId) { where.push('merchant_id = ?'); params.push(merchantId); }
  if (status)     { where.push('status = ?');      params.push(status); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [list, total] = await Promise.all([
    db.prepare(`SELECT * FROM withdrawals ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, offset).all<any>(),
    db.prepare(`SELECT COUNT(*) as count FROM withdrawals ${w}`).bind(...params).first<{ count: number }>(),
  ]);
  return { list: list.results ?? [], total: total?.count ?? 0 };
}

export async function createWithdrawal(db: D1Database, data: Record<string, unknown>) {
  return db.prepare(`
    INSERT INTO withdrawals (id,withdraw_no,merchant_id,amount,bank_name,bank_account,bank_holder,status)
    VALUES (?,?,?,?,?,?,?,'PENDING')
  `).bind(data.id, data.withdrawNo, data.merchantId, data.amount,
    data.bankName ?? null, data.bankAccount ?? null, data.bankHolder ?? null).run();
}

export async function updateWithdrawalStatus(db: D1Database, id: string, status: string, remark?: string) {
  if (status === 'TRANSFERRED') {
    return db.prepare(
      "UPDATE withdrawals SET status=?, transferred_at=datetime('now'), updated_at=datetime('now') WHERE id=?"
    ).bind(status, id).run();
  }
  return db.prepare(
    "UPDATE withdrawals SET status=?, audit_remark=?, audited_at=datetime('now'), updated_at=datetime('now') WHERE id=?"
  ).bind(status, remark ?? null, id).run();
}

// ── SystemConfig ───────────────────────────────────────
export async function listConfigs(db: D1Database) {
  const res = await db.prepare('SELECT * FROM system_configs ORDER BY key').all<any>();
  return res.results ?? [];
}

export async function upsertConfig(db: D1Database, key: string, value: string) {
  return db.prepare(`
    INSERT INTO system_configs (id, key, value, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `).bind(key, value).run();
}

// ── Stats ──────────────────────────────────────────────
export async function getOverviewStats(db: D1Database) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';
  const [
    ordersTotal, ordersPaid, ordersToday, ordersMonth,
    merchantsTotal, merchantsActive,
    withdrawalsPending,
    revenueTotal, revenueToday, revenueMonth,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) as v FROM orders").first<{v:number}>(),
    db.prepare("SELECT COUNT(*) as v FROM orders WHERE status='PAID'").first<{v:number}>(),
    db.prepare("SELECT COUNT(*) as v FROM orders WHERE date(created_at)=?").bind(today).first<{v:number}>(),
    db.prepare("SELECT COUNT(*) as v FROM orders WHERE created_at>=?").bind(monthStart).first<{v:number}>(),
    db.prepare("SELECT COUNT(*) as v FROM merchants").first<{v:number}>(),
    db.prepare("SELECT COUNT(*) as v FROM merchants WHERE status='ACTIVE'").first<{v:number}>(),
    db.prepare("SELECT COUNT(*) as v FROM withdrawals WHERE status='PENDING'").first<{v:number}>(),
    db.prepare("SELECT COALESCE(SUM(actual_amount),0) as v FROM orders WHERE status='PAID'").first<{v:number}>(),
    db.prepare("SELECT COALESCE(SUM(actual_amount),0) as v FROM orders WHERE status='PAID' AND date(paid_at)=?").bind(today).first<{v:number}>(),
    db.prepare("SELECT COALESCE(SUM(actual_amount),0) as v FROM orders WHERE status='PAID' AND paid_at>=?").bind(monthStart).first<{v:number}>(),
  ]);
  return {
    orders:      { total: ordersTotal?.v??0, paid: ordersPaid?.v??0, today: ordersToday?.v??0, thisMonth: ordersMonth?.v??0 },
    merchants:   { total: merchantsTotal?.v??0, active: merchantsActive?.v??0 },
    withdrawals: { pending: withdrawalsPending?.v??0 },
    revenue:     { total: revenueTotal?.v??0, today: revenueToday?.v??0, thisMonth: revenueMonth?.v??0 },
  };
}

export async function getTrendStats(db: D1Database, days = 7) {
  const results = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const [orders, revenue] = await Promise.all([
      db.prepare("SELECT COUNT(*) as v FROM orders WHERE date(created_at)=?").bind(date).first<{v:number}>(),
      db.prepare("SELECT COALESCE(SUM(actual_amount),0) as v FROM orders WHERE status='PAID' AND date(paid_at)=?").bind(date).first<{v:number}>(),
    ]);
    results.push({ date, orders: orders?.v ?? 0, revenue: revenue?.v ?? 0 });
  }
  return results;
}
