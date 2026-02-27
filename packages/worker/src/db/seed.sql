-- 众支付 D1 初始数据
-- 管理员密码: Admin@123456 (plain: 前缀，首次登录自动升级为 PBKDF2)
INSERT OR IGNORE INTO admins (id, username, password, email, role, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  'plain:Admin@123456',
  'admin@zhongpay.com',
  'SUPER_ADMIN',
  1
);

-- 系统配置
INSERT OR IGNORE INTO system_configs (id, key, value, remark) VALUES
  ('cfg-001', 'platform_name',       '众支付',                      '平台名称'),
  ('cfg-002', 'platform_url',        'https://zhong-pay-worker.bg-e6e.workers.dev', '平台域名'),
  ('cfg-003', 'default_fee_rate',    '0.006',                       '默认手续费率(0.6%)'),
  ('cfg-004', 'min_withdraw_amount', '100',                         '最低提现金额'),
  ('cfg-005', 'max_withdraw_amount', '50000',                       '最高单次提现金额'),
  ('cfg-006', 'order_expire_minutes','30',                          '订单过期时间(分钟)'),
  ('cfg-007', 'notify_retry_times',  '5',                           '回调重试次数');
