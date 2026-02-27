import { Hono } from 'hono';
import type { Env } from '../index';
import { getOverviewStats, getTrendStats } from '../utils/db';
import { authenticate } from '../middlewares/auth';

export const statsRoutes = new Hono<{ Bindings: Env }>();
statsRoutes.use('*', authenticate());

statsRoutes.get('/overview', async (c) => {
  const data = await getOverviewStats(c.env.DB);
  return c.json({ code: 0, data });
});

statsRoutes.get('/trend', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const data = await getTrendStats(c.env.DB, days);
  return c.json({ code: 0, data });
});
