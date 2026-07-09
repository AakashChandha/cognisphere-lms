import { createApp } from './app.js';
import { config } from './config/env.js';
import { closePool } from './models/db.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`LMS backend listening on port ${config.port}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down backend.`);

  server.close(async () => {
    await closePool();
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
