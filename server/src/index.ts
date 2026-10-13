import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

async function bootstrap() {
  console.log(`[Startup] Initializing Deep's Cake Shop Backend Server...`);

  // Attempt database connection
  await connectDB();

  const server = app.listen(env.PORT, () => {
    console.log(`-----------------------------------------------------`);
    console.log(`🍰 Deep's Cake Shop API running at http://localhost:${env.PORT}`);
    console.log(`📡 Health Check: http://localhost:${env.PORT}/api/health`);
    console.log(`🎂 Cake Catalog: http://localhost:${env.PORT}/api/cakes`);
    console.log(`📂 Categories:   http://localhost:${env.PORT}/api/categories`);
    console.log(`-----------------------------------------------------`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('[Shutdown] Terminating server cleanly...');
    server.close(() => {
      console.log('[Shutdown] Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Fatal Error] Failed to start server:', err);
  process.exit(1);
});
