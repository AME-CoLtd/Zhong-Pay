/**
 * Vercel Serverless 适配器
 * 将 Express app 包装为 Vercel handler
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel 环境下转发给 Express
  return new Promise<void>((resolve) => {
    // @ts-ignore
    app(req, res);
    res.on('finish', resolve);
  });
}
