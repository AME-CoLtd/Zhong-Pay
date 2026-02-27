-- 众支付 D1 数据库初始化 SQL (SQLite)
-- Copyright (c) 2026 AME & Entertainment

-- 管理员
CREATE TABLE IF NOT EXISTS admins (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  email       TEXT UNIQUE,
  phone       TEXT UNIQUE,
  role        TEXT NOT NULL DEFAULT 'STAFF',   -- SUPER_ADMIN | ADMIN | STAFF
  is_active   INTEGER NOT NULL DEFAULT 1,
  last_login  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 商户
CREATE TABLE IF NOT EXISTS merchants (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  phone        TEXT,
  api_key      TEXT NOT NULL UNIQUE,
  api_secret   TEXT NOT NULL,
  notify_url   TEXT,
  return_url   TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | INACTIVE | SUSPENDED
  balance      REAL NOT NULL DEFAULT 0,
  total_income REAL NOT NULL DEFAULT 0,
  fee_rate     REAL NOT NULL DEFAULT 0.006,
  remark       TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 订单
CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  order_no       TEXT NOT NULL UNIQUE,
  merchant_id    TEXT NOT NULL,
  out_trade_no   TEXT NOT NULL,
  subject        TEXT NOT NULL,
  body           TEXT,
  amount         REAL NOT NULL,
  actual_amount  REAL,
  fee_amount     REAL,
  currency       TEXT NOT NULL DEFAULT 'CNY',
  pay_type       TEXT NOT NULL,   -- ALIPAY | WECHAT
  channel        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDING',
  third_trade_no TEXT,
  client_ip      TEXT,
  device_info    TEXT,
  extra          TEXT,            -- JSON string
  notify_url     TEXT,
  return_url     TEXT,
  notified_at    TEXT,
  notify_count   INTEGER NOT NULL DEFAULT 0,
  paid_at        TEXT,
  expired_at     TEXT,
  closed_at      TEXT,
  refunded_amount REAL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_merchant_id ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_out_trade_no ON orders(out_trade_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 退款
CREATE TABLE IF NOT EXISTS refunds (
  id              TEXT PRIMARY KEY,
  refund_no       TEXT NOT NULL UNIQUE,
  order_id        TEXT NOT NULL,
  amount          REAL NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  third_refund_no TEXT,
  refunded_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);

-- 提现
CREATE TABLE IF NOT EXISTS withdrawals (
  id             TEXT PRIMARY KEY,
  withdraw_no    TEXT NOT NULL UNIQUE,
  merchant_id    TEXT NOT NULL,
  amount         REAL NOT NULL,
  actual_amount  REAL,
  fee_amount     REAL,
  bank_name      TEXT,
  bank_account   TEXT,
  bank_holder    TEXT,
  status         TEXT NOT NULL DEFAULT 'PENDING',
  remark         TEXT,
  audit_remark   TEXT,
  audited_at     TEXT,
  transferred_at TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_merchant_id ON withdrawals(merchant_id);

-- 结算
CREATE TABLE IF NOT EXISTS settlements (
  id          TEXT PRIMARY KEY,
  settle_no   TEXT NOT NULL UNIQUE,
  merchant_id TEXT NOT NULL,
  amount      REAL NOT NULL,
  fee_amount  REAL NOT NULL,
  net_amount  REAL NOT NULL,
  order_count INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  settled_at  TEXT,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id)
);
CREATE INDEX IF NOT EXISTS idx_settlements_merchant_id ON settlements(merchant_id);

-- 系统配置
CREATE TABLE IF NOT EXISTS system_configs (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  remark     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 操作日志
CREATE TABLE IF NOT EXISTS operation_logs (
  id          TEXT PRIMARY KEY,
  operator    TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  action      TEXT NOT NULL,
  module      TEXT NOT NULL,
  target_id   TEXT,
  detail      TEXT,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_oplogs_operator_id ON operation_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_oplogs_module ON operation_logs(module);
