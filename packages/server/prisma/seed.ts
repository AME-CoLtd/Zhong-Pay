import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化数据...');

  // 创建超级管理员
  const hashedPassword = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      id: uuidv4(),
      username: 'admin',
      password: hashedPassword,
      email: 'admin@zhongpay.com',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log('管理员创建成功:', admin.username);

  // 创建系统配置
  const configs = [
    { key: 'platform_name', value: '众支付', remark: '平台名称' },
    { key: 'platform_url', value: 'http://localhost:3000', remark: '平台域名' },
    { key: 'default_fee_rate', value: '0.006', remark: '默认手续费率 (0.6%)' },
    { key: 'min_withdraw_amount', value: '100', remark: '最低提现金额' },
    { key: 'max_withdraw_amount', value: '50000', remark: '最高单次提现金额' },
    { key: 'order_expire_minutes', value: '30', remark: '订单过期时间(分钟)' },
    { key: 'notify_retry_times', value: '5', remark: '回调重试次数' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: { id: uuidv4(), ...config },
    });
  }
  console.log('系统配置初始化完成');

  // 创建测试商户
  const testMerchant = await prisma.merchant.upsert({
    where: { email: 'test@merchant.com' },
    update: {},
    create: {
      id: uuidv4(),
      name: '测试商户',
      email: 'test@merchant.com',
      phone: '13800138000',
      apiKey: 'test_' + uuidv4().replace(/-/g, ''),
      apiSecret: uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, ''),
      notifyUrl: 'http://localhost:8080/notify',
      returnUrl: 'http://localhost:8080/return',
      feeRate: 0.006,
      status: 'ACTIVE',
    },
  });
  console.log('测试商户创建成功:', testMerchant.name);
  console.log('  API Key:', testMerchant.apiKey);

  console.log('\n✅ 数据初始化完成！');
  console.log('管理员账号: admin');
  console.log('管理员密码: Admin@123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
