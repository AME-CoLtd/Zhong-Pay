import { Hono } from 'hono';
import type { Env } from '../index';
import { listConfigs, upsertConfig } from '../utils/db';
import { authenticate } from '../middlewares/auth';
import { sendEmail } from '../utils/email';

export const configRoutes = new Hono<{ Bindings: Env }>();
configRoutes.use('*', authenticate());

// GET /api/configs  → 获取全部配置，返回数组
configRoutes.get('/', async (c) => {
  const rows = await listConfigs(c.env.DB);
  return c.json({ code: 0, data: rows });
});

// PUT /api/configs/:key  → 更新单条配置
configRoutes.put('/:key', async (c) => {
  const key = c.req.param('key');
  const { value } = await c.req.json<{ value: string }>();
  if (value === undefined || value === null) {
    return c.json({ code: 400, message: '缺少 value 参数' }, 400);
  }
  await upsertConfig(c.env.DB, key, String(value));
  return c.json({ code: 0, message: '保存成功' });
});

// POST /api/configs/test-email  → 发送测试邮件
configRoutes.post('/test-email', async (c) => {
  const { to } = await c.req.json<{ to?: string }>();
  if (!to || !to.includes('@')) {
    return c.json({ code: 400, message: '请提供有效的收件邮箱地址' }, 400);
  }
  try {
    await sendEmail(c.env.DB, {
      to,
      subject: '众支付 - 邮件服务测试',
      html: `<div style="font-family:sans-serif;padding:24px;">
        <h2 style="color:#1677ff;">邮件服务测试</h2>
        <p>这是一封来自 <strong>众支付</strong> 系统的测试邮件。</p>
        <p>如果您收到此邮件，说明邮件服务配置正确。</p>
        <p style="color:#999;font-size:12px;margin-top:24px;">发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
      </div>`,
    });
    return c.json({ code: 0, message: '测试邮件发送成功，请检查收件箱' });
  } catch (e: any) {
    return c.json({ code: 500, message: e.message ?? '发送失败' }, 500);
  }
});
