import { Hono } from 'hono';
import type { Env } from '../index';
import { authenticate, requireRole } from '../middlewares/auth';
import { authenticateCustomer } from '../middlewares/customerAuth';
import { generateOrderNo, hashPassword, signJWT, verifyPassword } from '../utils/crypto';
import { createOrder } from '../utils/db';
import { ensureStoreTables } from '../utils/storeDb';

export const storeRoutes = new Hono<{ Bindings: Env }>();

storeRoutes.use('*', async (c, next) => {
  await ensureStoreTables(c.env.DB);
  return next();
});

// --------- 商品（前台） ---------
storeRoutes.get('/products', async (c) => {
  const { keyword = '', page = '1', pageSize = '20' } = c.req.query();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
  const offset = (p - 1) * ps;

  const kw = `%${keyword}%`;
  const [listRes, totalRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id,name,description,cover,price,stock,status,created_at,updated_at
       FROM products
       WHERE status='ON_SHELF' AND name LIKE ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(kw, ps, offset).all<any>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM products WHERE status='ON_SHELF' AND name LIKE ?`
    ).bind(kw).first<{ count: number }>(),
  ]);

  return c.json({
    code: 0,
    data: {
      list: listRes.results ?? [],
      total: totalRes?.count ?? 0,
      page: p,
      pageSize: ps,
    },
  });
});

storeRoutes.get('/products/:id', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id,name,description,cover,price,stock,status,created_at,updated_at
     FROM products WHERE id=? AND status='ON_SHELF'`
  ).bind(c.req.param('id')).first<any>();

  if (!row) return c.json({ code: 404, message: '商品不存在或已下架' }, 404);
  return c.json({ code: 0, data: row });
});

// --------- 商品（后台管理） ---------
storeRoutes.get('/admin/products', authenticate(), requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const { keyword = '', page = '1', pageSize = '20' } = c.req.query();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
  const offset = (p - 1) * ps;
  const kw = `%${keyword}%`;

  const [listRes, totalRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id,name,description,cover,price,stock,status,created_at,updated_at
       FROM products
       WHERE name LIKE ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(kw, ps, offset).all<any>(),
    c.env.DB.prepare(`SELECT COUNT(*) as count FROM products WHERE name LIKE ?`).bind(kw).first<{ count: number }>(),
  ]);

  return c.json({ code: 0, data: { list: listRes.results ?? [], total: totalRes?.count ?? 0, page: p, pageSize: ps } });
});

storeRoutes.post('/admin/products', authenticate(), requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const { name, description, cover, price, stock = 0, status = 'OFF_SHELF' } = await c.req.json<any>();
  if (!name || Number(price) <= 0) {
    return c.json({ code: 400, message: '请填写商品名称和正确价格' }, 400);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO products (id,name,description,cover,price,stock,status,updated_at)
     VALUES (?,?,?,?,?,?,?,datetime('now'))`
  ).bind(
    id,
    String(name),
    description ? String(description) : null,
    cover ? String(cover) : null,
    Number(price),
    Math.max(0, parseInt(String(stock), 10) || 0),
    status === 'ON_SHELF' ? 'ON_SHELF' : 'OFF_SHELF',
  ).run();

  return c.json({ code: 0, message: '商品创建成功', data: { id } });
});

storeRoutes.put('/admin/products/:id', authenticate(), requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const id = c.req.param('id');
  const { name, description, cover, price, stock, status } = await c.req.json<any>();

  const existed = await c.env.DB.prepare('SELECT id FROM products WHERE id=?').bind(id).first();
  if (!existed) return c.json({ code: 404, message: '商品不存在' }, 404);

  await c.env.DB.prepare(
    `UPDATE products SET
      name=?, description=?, cover=?, price=?, stock=?, status=?, updated_at=datetime('now')
     WHERE id=?`
  ).bind(
    String(name || ''),
    description ? String(description) : null,
    cover ? String(cover) : null,
    Number(price || 0),
    Math.max(0, parseInt(String(stock ?? 0), 10) || 0),
    status === 'ON_SHELF' ? 'ON_SHELF' : 'OFF_SHELF',
    id,
  ).run();

  return c.json({ code: 0, message: '商品更新成功' });
});

storeRoutes.post('/admin/products/:id/toggle', authenticate(), requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT status FROM products WHERE id=?').bind(id).first<{ status: string }>();
  if (!row) return c.json({ code: 404, message: '商品不存在' }, 404);

  const next = row.status === 'ON_SHELF' ? 'OFF_SHELF' : 'ON_SHELF';
  await c.env.DB.prepare(`UPDATE products SET status=?, updated_at=datetime('now') WHERE id=?`).bind(next, id).run();
  return c.json({ code: 0, message: next === 'ON_SHELF' ? '已上架' : '已下架', data: { status: next } });
});

// --------- 客户管理（后台） ---------
storeRoutes.get('/admin/customers', authenticate(), requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const { keyword = '', page = '1', pageSize = '20' } = c.req.query();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
  const offset = (p - 1) * ps;
  const kw = `%${keyword}%`;

  const [listRes, totalRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id,username,nickname,email,phone,is_active,created_at,updated_at
       FROM customers
       WHERE username LIKE ? OR nickname LIKE ? OR email LIKE ? OR phone LIKE ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(kw, kw, kw, kw, ps, offset).all<any>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM customers WHERE username LIKE ? OR nickname LIKE ? OR email LIKE ? OR phone LIKE ?`
    ).bind(kw, kw, kw, kw).first<{ count: number }>(),
  ]);

  return c.json({ code: 0, data: { list: listRes.results ?? [], total: totalRes?.count ?? 0, page: p, pageSize: ps } });
});

storeRoutes.put('/admin/customers/:id', authenticate(), requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const id = c.req.param('id');
  const { nickname, email, phone, isActive } = await c.req.json<any>();

  const existed = await c.env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(id).first();
  if (!existed) return c.json({ code: 404, message: '客户不存在' }, 404);

  await c.env.DB.prepare(
    `UPDATE customers SET nickname=?, email=?, phone=?, is_active=?, updated_at=datetime('now') WHERE id=?`
  ).bind(
    nickname ? String(nickname) : null,
    email ? String(email) : null,
    phone ? String(phone) : null,
    isActive ? 1 : 0,
    id,
  ).run();

  return c.json({ code: 0, message: '客户更新成功' });
});

storeRoutes.post('/admin/customers/:id/reset-password', authenticate(), requireRole('SUPER_ADMIN', 'ADMIN'), async (c) => {
  const id = c.req.param('id');
  const { password } = await c.req.json<any>();
  if (!password || String(password).length < 6) {
    return c.json({ code: 400, message: '新密码至少6位' }, 400);
  }

  const existed = await c.env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(id).first();
  if (!existed) return c.json({ code: 404, message: '客户不存在' }, 404);

  const hashed = await hashPassword(String(password));
  await c.env.DB.prepare(
    `UPDATE customers SET password=?, updated_at=datetime('now') WHERE id=?`
  ).bind(hashed, id).run();

  return c.json({ code: 0, message: '密码重置成功' });
});

// --------- 客户认证 ---------
storeRoutes.post('/auth/register', async (c) => {
  const { username, password, nickname, email, phone } = await c.req.json<any>();
  if (!username || !password || String(password).length < 6) {
    return c.json({ code: 400, message: '请输入用户名和至少6位密码' }, 400);
  }

  const existed = await c.env.DB.prepare('SELECT id FROM customers WHERE username=?').bind(username).first();
  if (existed) return c.json({ code: 400, message: '用户名已存在' }, 400);

  const id = crypto.randomUUID();
  const hashed = await hashPassword(String(password));
  await c.env.DB.prepare(
    `INSERT INTO customers (id,username,password,nickname,email,phone,is_active,updated_at)
     VALUES (?,?,?,?,?,?,1,datetime('now'))`
  ).bind(
    id,
    String(username),
    hashed,
    nickname ? String(nickname) : null,
    email ? String(email) : null,
    phone ? String(phone) : null,
  ).run();

  const token = await signJWT({ customerId: id, username: String(username), type: 'customer' }, c.env.JWT_SECRET);
  return c.json({ code: 0, message: '注册成功', data: { token, customer: { id, username, nickname, email, phone } } });
});

storeRoutes.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json<any>();
  if (!username || !password) return c.json({ code: 400, message: '请输入用户名和密码' }, 400);

  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE username=?').bind(username).first<any>();
  if (!customer || !customer.is_active) {
    return c.json({ code: 401, message: '账号不存在或已禁用' }, 401);
  }

  const valid = await verifyPassword(String(password), customer.password);
  if (!valid) return c.json({ code: 401, message: '用户名或密码错误' }, 401);

  const token = await signJWT({ customerId: customer.id, username: customer.username, type: 'customer' }, c.env.JWT_SECRET);
  return c.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      customer: {
        id: customer.id,
        username: customer.username,
        nickname: customer.nickname,
        email: customer.email,
        phone: customer.phone,
      },
    },
  });
});

// --------- 用户中心 ---------
storeRoutes.get('/me', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const row = await c.env.DB.prepare(
    'SELECT id,username,nickname,email,phone,created_at FROM customers WHERE id=?'
  ).bind(customer.customerId).first<any>();

  if (!row) return c.json({ code: 404, message: '用户不存在' }, 404);
  return c.json({ code: 0, data: row });
});

storeRoutes.put('/me', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const { nickname, email, phone } = await c.req.json<any>();

  await c.env.DB.prepare(
    `UPDATE customers SET nickname=?, email=?, phone=?, updated_at=datetime('now') WHERE id=?`
  ).bind(
    nickname ? String(nickname) : null,
    email ? String(email) : null,
    phone ? String(phone) : null,
    customer.customerId,
  ).run();

  return c.json({ code: 0, message: '资料更新成功' });
});

// --------- 购物车 ---------
storeRoutes.get('/cart', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;

  let cart = await c.env.DB.prepare('SELECT id FROM carts WHERE customer_id=?').bind(customer.customerId).first<{ id: string }>();
  if (!cart) {
    const cartId = crypto.randomUUID();
    await c.env.DB.prepare('INSERT INTO carts (id,customer_id,updated_at) VALUES (?,?,datetime(\'now\'))')
      .bind(cartId, customer.customerId).run();
    cart = { id: cartId };
  }

  const items = await c.env.DB.prepare(
    `SELECT
      ci.id, ci.product_id, ci.quantity, ci.price_snapshot,
      p.name, p.cover, p.price, p.stock, p.status
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    WHERE ci.cart_id=?
    ORDER BY ci.created_at DESC`
  ).bind(cart.id).all<any>();

  const list = (items.results ?? []).map((it: any) => ({
    id: it.id,
    productId: it.product_id,
    name: it.name,
    cover: it.cover,
    quantity: it.quantity,
    price: it.price,
    priceSnapshot: it.price_snapshot,
    stock: it.stock,
    status: it.status,
    amount: Number(it.price_snapshot) * Number(it.quantity),
  }));

  return c.json({ code: 0, data: { list, totalAmount: list.reduce((s, i) => s + i.amount, 0) } });
});

storeRoutes.post('/cart/items', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const { productId, quantity = 1 } = await c.req.json<any>();

  const q = Math.max(1, parseInt(String(quantity), 10) || 1);
  const product = await c.env.DB.prepare('SELECT id,price,stock,status FROM products WHERE id=?').bind(productId).first<any>();
  if (!product || product.status !== 'ON_SHELF') {
    return c.json({ code: 400, message: '商品不可购买' }, 400);
  }
  if (q > Number(product.stock || 0)) {
    return c.json({ code: 400, message: '库存不足' }, 400);
  }

  let cart = await c.env.DB.prepare('SELECT id FROM carts WHERE customer_id=?').bind(customer.customerId).first<{ id: string }>();
  if (!cart) {
    const cartId = crypto.randomUUID();
    await c.env.DB.prepare('INSERT INTO carts (id,customer_id,updated_at) VALUES (?,?,datetime(\'now\'))')
      .bind(cartId, customer.customerId).run();
    cart = { id: cartId };
  }

  const existed = await c.env.DB.prepare('SELECT id,quantity FROM cart_items WHERE cart_id=? AND product_id=?')
    .bind(cart.id, productId).first<any>();

  if (existed) {
    const nextQty = Number(existed.quantity) + q;
    if (nextQty > Number(product.stock || 0)) {
      return c.json({ code: 400, message: '库存不足' }, 400);
    }
    await c.env.DB.prepare(
      `UPDATE cart_items SET quantity=?, price_snapshot=?, updated_at=datetime('now') WHERE id=?`
    ).bind(nextQty, Number(product.price), existed.id).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO cart_items (id,cart_id,product_id,quantity,price_snapshot,updated_at)
       VALUES (?,?,?,?,?,datetime('now'))`
    ).bind(crypto.randomUUID(), cart.id, productId, q, Number(product.price)).run();
  }

  await c.env.DB.prepare('UPDATE carts SET updated_at=datetime(\'now\') WHERE id=?').bind(cart.id).run();
  return c.json({ code: 0, message: '已加入购物车' });
});

storeRoutes.put('/cart/items/:id', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const { quantity } = await c.req.json<any>();
  const q = Math.max(1, parseInt(String(quantity), 10) || 1);

  const item = await c.env.DB.prepare(
    `SELECT ci.id,ci.cart_id,ci.product_id,p.stock
     FROM cart_items ci
     JOIN carts c ON c.id=ci.cart_id
     JOIN products p ON p.id=ci.product_id
     WHERE ci.id=? AND c.customer_id=?`
  ).bind(c.req.param('id'), customer.customerId).first<any>();

  if (!item) return c.json({ code: 404, message: '购物车项不存在' }, 404);
  if (q > Number(item.stock || 0)) return c.json({ code: 400, message: '库存不足' }, 400);

  await c.env.DB.prepare('UPDATE cart_items SET quantity=?, updated_at=datetime(\'now\') WHERE id=?').bind(q, item.id).run();
  await c.env.DB.prepare('UPDATE carts SET updated_at=datetime(\'now\') WHERE id=?').bind(item.cart_id).run();
  return c.json({ code: 0, message: '购物车已更新' });
});

storeRoutes.delete('/cart/items/:id', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const item = await c.env.DB.prepare(
    `SELECT ci.id,ci.cart_id
     FROM cart_items ci
     JOIN carts c ON c.id=ci.cart_id
     WHERE ci.id=? AND c.customer_id=?`
  ).bind(c.req.param('id'), customer.customerId).first<any>();

  if (!item) return c.json({ code: 404, message: '购物车项不存在' }, 404);

  await c.env.DB.prepare('DELETE FROM cart_items WHERE id=?').bind(item.id).run();
  await c.env.DB.prepare('UPDATE carts SET updated_at=datetime(\'now\') WHERE id=?').bind(item.cart_id).run();
  return c.json({ code: 0, message: '已移除' });
});

// --------- 客户订单（用户中心） ---------
storeRoutes.post('/orders/checkout', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const { channel = 'ALIPAY_PC' } = await c.req.json<any>().catch(() => ({ channel: 'ALIPAY_PC' }));

  if (!['ALIPAY_PC', 'ALIPAY_WAP', 'WECHAT_NATIVE'].includes(channel)) {
    return c.json({ code: 400, message: '不支持的支付渠道' }, 400);
  }

  const cart = await c.env.DB.prepare('SELECT id FROM carts WHERE customer_id=?').bind(customer.customerId).first<{ id: string }>();
  if (!cart) return c.json({ code: 400, message: '购物车为空' }, 400);

  const itemsRes = await c.env.DB.prepare(
    `SELECT ci.id,ci.product_id,ci.quantity,ci.price_snapshot,p.name,p.cover,p.stock,p.status
     FROM cart_items ci JOIN products p ON p.id=ci.product_id
     WHERE ci.cart_id=?`
  ).bind(cart.id).all<any>();
  const items = itemsRes.results ?? [];

  if (!items.length) return c.json({ code: 400, message: '购物车为空' }, 400);

  for (const it of items) {
    if (it.status !== 'ON_SHELF') return c.json({ code: 400, message: `商品已下架：${it.name}` }, 400);
    if (Number(it.quantity) > Number(it.stock || 0)) return c.json({ code: 400, message: `库存不足：${it.name}` }, 400);
  }

  const merchant = await c.env.DB.prepare("SELECT * FROM merchants WHERE status='ACTIVE' ORDER BY created_at ASC LIMIT 1").first<any>();
  if (!merchant) {
    return c.json({ code: 400, message: '暂无可用商户，请先在后台创建并启用商户' }, 400);
  }

  const customerOrderId = crypto.randomUUID();
  const customerOrderNo = `CO${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  const totalAmount = items.reduce((s, it) => s + Number(it.price_snapshot) * Number(it.quantity), 0);
  const payOrderNo = generateOrderNo();
  const payOrderId = crypto.randomUUID();
  const expiredAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  let payData: Record<string, string> = {};
  try {
    payData = await callStorePayChannel(channel, {
      orderNo: payOrderNo,
      amount: String(totalAmount),
      subject: `商城订单-${customerOrderNo}`,
      notifyUrl: merchant.notify_url || c.env.ALIPAY_NOTIFY_URL,
      returnUrl: merchant.return_url || '',
      clientIp: c.req.header('CF-Connecting-IP') || '127.0.0.1',
      env: c.env,
    });
  } catch (err: any) {
    return c.json({ code: 500, message: `创建支付单失败: ${err.message}` }, 500);
  }

  await c.env.DB.prepare(
    `INSERT INTO customer_orders (id,order_no,customer_id,total_amount,status,updated_at)
     VALUES (?,?,?,?, 'PENDING', datetime('now'))`
  ).bind(customerOrderId, customerOrderNo, customer.customerId, totalAmount).run();

  for (const it of items) {
    await c.env.DB.prepare(
      `INSERT INTO customer_order_items (id,order_id,product_id,product_name,product_cover,price,quantity,amount)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(
      crypto.randomUUID(),
      customerOrderId,
      it.product_id,
      it.name,
      it.cover,
      Number(it.price_snapshot),
      Number(it.quantity),
      Number(it.price_snapshot) * Number(it.quantity),
    ).run();

    await c.env.DB.prepare(
      `UPDATE products SET stock = stock - ?, updated_at=datetime('now') WHERE id=?`
    ).bind(Number(it.quantity), it.product_id).run();
  }

  await createOrder(c.env.DB, {
    id: payOrderId,
    orderNo: payOrderNo,
    merchantId: merchant.id,
    outTradeNo: customerOrderNo,
    subject: `商城订单-${customerOrderNo}`,
    amount: totalAmount,
    payType: channel.startsWith('ALIPAY') ? 'ALIPAY' : 'WECHAT',
    channel,
    clientIp: c.req.header('CF-Connecting-IP') || '',
    notifyUrl: merchant.notify_url || '',
    returnUrl: merchant.return_url || '',
    expiredAt,
  });

  await c.env.DB.prepare('DELETE FROM cart_items WHERE cart_id=?').bind(cart.id).run();
  await c.env.DB.prepare('UPDATE carts SET updated_at=datetime(\'now\') WHERE id=?').bind(cart.id).run();

  return c.json({
    code: 0,
    message: '下单成功，请完成支付',
    data: {
      customerOrderNo,
      payOrderNo,
      totalAmount,
      channel,
      expiredAt,
      ...payData,
    },
  });
});

storeRoutes.post('/orders/:orderNo/cancel', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const orderNo = c.req.param('orderNo');

  const order = await c.env.DB.prepare(
    `SELECT id,order_no,status FROM customer_orders WHERE order_no=? AND customer_id=?`
  ).bind(orderNo, customer.customerId).first<any>();

  if (!order) return c.json({ code: 404, message: '订单不存在' }, 404);
  if (order.status !== 'PENDING') {
    return c.json({ code: 400, message: '仅待支付订单可取消' }, 400);
  }

  const itemsRes = await c.env.DB.prepare(
    `SELECT product_id, quantity FROM customer_order_items WHERE order_id=?`
  ).bind(order.id).all<any>();

  for (const it of itemsRes.results ?? []) {
    await c.env.DB.prepare(
      `UPDATE products SET stock = stock + ?, updated_at=datetime('now') WHERE id=?`
    ).bind(Number(it.quantity), it.product_id).run();
  }

  await c.env.DB.prepare(
    `UPDATE customer_orders SET status='CLOSED', updated_at=datetime('now') WHERE id=?`
  ).bind(order.id).run();

  await c.env.DB.prepare(
    `UPDATE orders SET status='CLOSED', updated_at=datetime('now') WHERE out_trade_no=? AND status='PENDING'`
  ).bind(orderNo).run();

  return c.json({ code: 0, message: '订单已取消' });
});

storeRoutes.get('/orders', authenticateCustomer(), async (c) => {
  const customer = c.get('customer' as any) as any;
  const ordersRes = await c.env.DB.prepare(
    `SELECT id,order_no,total_amount,status,created_at
     FROM customer_orders
     WHERE customer_id=?
     ORDER BY created_at DESC`
  ).bind(customer.customerId).all<any>();

  const orders = ordersRes.results ?? [];
  const list = [] as any[];

  for (const o of orders) {
    const itemsRes = await c.env.DB.prepare(
      `SELECT product_name,product_cover,price,quantity,amount
       FROM customer_order_items WHERE order_id=?`
    ).bind(o.id).all<any>();

    list.push({
      id: o.id,
      orderNo: o.order_no,
      totalAmount: o.total_amount,
      status: o.status,
      createdAt: o.created_at,
      items: itemsRes.results ?? [],
    });
  }

  return c.json({ code: 0, data: list });
});

async function callStorePayChannel(
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
    return { payUrl: `https://openapi.alipay.com/gateway.do?${queryParams.toString()}` };
  }

  if (channel === 'WECHAT_NATIVE') {
    if (!params.env.WECHAT_APP_ID || !params.env.WECHAT_MCH_ID) {
      throw new Error('微信支付参数未配置，请先在系统配置中填写并同步到环境变量');
    }
    const resp = await fetch('https://api.mch.weixin.qq.com/v3/pay/transactions/native', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${params.env.WECHAT_MCH_ID}"`,
      },
      body: JSON.stringify({
        appid: params.env.WECHAT_APP_ID,
        mchid: params.env.WECHAT_MCH_ID,
        description: params.subject,
        out_trade_no: params.orderNo,
        notify_url: params.notifyUrl,
        amount: { total: Math.round(Number(params.amount) * 100), currency: 'CNY' },
      }),
    });
    const result: any = await resp.json().catch(() => ({}));
    if (result.code_url) return { codeUrl: result.code_url };
    throw new Error(result.message || '微信支付配置错误或未开通（当前环境未完成证书签名接入）');
  }

  throw new Error(`不支持的支付渠道: ${channel}`);
}
