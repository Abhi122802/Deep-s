import { Router, Request, Response } from 'express';
import { isDbConnected } from '../config/db.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const dbStatus = isDbConnected() ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    service: "Deep's Cake Shop API",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    version: '2.0.0',
  });
});

export default router;
