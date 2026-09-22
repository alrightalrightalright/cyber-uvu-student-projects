import 'dotenv/config';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import pino from 'pino';
import { createPool, readSecret, required } from './db.js';
import { createApp } from './app.js';
const logger = pino();
const mode = required('APP_MODE');
if (!['local', 'production'].includes(mode)) throw new Error('APP_MODE must be local or production');
const origins = required('CORS_ORIGINS').split(',').map(s => s.trim());
for (const origin of origins) {
  const url = new URL(origin);
  if (url.origin !== origin || (mode === 'production' && url.protocol !== 'https:')) throw new Error('Invalid CORS origin');
  if (mode === 'local' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local mode requires loopback origins');
}
const pool = createPool();
await pool.query('SELECT id FROM users LIMIT 1');
const app = await createApp({ pool, sessionSecret: readSecret('SESSION_SECRET'), origins,
  secureCookies: mode === 'production', logger, staticDirectory: path.resolve(process.env.STATIC_DIR || '../client/dist') });
const port = Number(process.env.PORT || 4000), host = process.env.HOST || '127.0.0.1';
const server = mode === 'production'
  ? https.createServer({ key: fs.readFileSync(required('HTTPS_KEY_FILE')), cert: fs.readFileSync(required('HTTPS_CERT_FILE')), minVersion: 'TLSv1.2' }, app).listen(port, host)
  : app.listen(port, host);
logger.info({ event: 'server_started', mode, host, port });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => {
  app.locals.sessionStore.close(); await pool.end(); process.exit(0);
}));
