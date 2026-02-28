import { Hono } from 'hono';
import type { Env } from '../index';
import { authenticate, requireRole } from '../middlewares/auth';
import { authenticateCustomer } from '../middlewares/customerAuth';
import { hashPassword, signJWT, verifyPassword } from '../utils/crypto';
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

  const orderId = crypto.randomUUID();
  const orderNo = `CO${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
  const totalAmount = items.reduce((s, it) => s + Number(it.price_snapshot) * Number(it.quantity), 0);

  await c.env.DB.prepare(
    `INSERT INTO customer_orders (id,order_no,customer_id,total_amount,status,updated_at)
     VALUES (?,?,?,?, 'PENDING', datetime('now'))`
  ).bind(orderId, orderNo, customer.customerId, totalAmount).run();

  for (const it of items) {
    await c.env.DB.prepare(
      `INSERT INTO customer_order_items (id,order_id,product_id,product_name,product_cover,price,quantity,amount)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(
      crypto.randomUUID(),
      orderId,
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

  await c.env.DB.prepare('DELETE FROM cart_items WHERE cart_id=?').bind(cart.id).run();
  await c.env.DB.prepare('UPDATE carts SET updated_at=datetime(\'now\') WHERE id=?').bind(cart.id).run();

  return c.json({ code: 0, message: '下单成功', data: { orderNo, totalAmount } });
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
