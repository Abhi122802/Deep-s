import { Router, Request, Response } from 'express';
import { isDbConnected } from '../config/db.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const isConnected = isDbConnected();
  const dbStatus = isConnected ? 'connected' : 'disconnected';
  const statusCode = isConnected ? 200 : 503;

  res.status(statusCode).json({
    status: isConnected ? 'ok' : 'degraded',
    service: "Deep's Cake Shop API",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    version: '2.0.0',
  });
});

export default router;
