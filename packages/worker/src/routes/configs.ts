import { Hono } from 'hono';
import type { Env } from '../index';
import { listConfigs, upsertConfig } from '../utils/db';
import { authenticate } from '../middlewares/auth';

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
