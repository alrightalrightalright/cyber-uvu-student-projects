import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { rateLimit } from 'express-rate-limit';
import argon2 from 'argon2';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import pino from 'pino';
import { credentials } from './validate.js';
import { birthdayRouter, wrap } from './routes.js';
export const IDLE_MS = 15 * 60 * 1000;
export const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
export const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const csrf = () => randomBytes(32).toString('hex');
const equalToken = (a, b) => typeof a === 'string' && typeof b === 'string'
  && /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b)
  && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function createApp({ pool, sessionSecret, origins, secureCookies = false,
  logger = pino(), limits = {}, now = Date.now, staticDirectory }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((req, res, next) => { req.id = randomUUID(); res.set('X-Request-ID', req.id); next(); });
  app.use(helmet({ strictTransportSecurity: secureCookies ? undefined : false,
    contentSecurityPolicy: { directives: { 'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': secureCookies ? [] : null } } }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin && !origins.includes(req.headers.origin)) return res.status(403).json({ error: 'Origin not allowed' });
    next();
  });
  app.use('/api', cors({ origin: origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'] }));
  const limiter = (limit) => rateLimit({ windowMs: 60000, limit, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many requests; try again later' } });
  app.use('/api', limiter(limits.global ?? 180));
  app.use(express.json({ limit: '8kb', strict: true }));
  app.get('/api/health', wrap(async (req, res) => {
    try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
    catch (err) { logger.error({ event: 'health_failed', code: err.code, requestId: req.id }, 'Database unavailable');
      res.status(503).json({ status: 'unavailable' }); }
  }));
  const PgStore = connectPgSimple(session);
  const store = new PgStore({ pool, tableName: 'sessions', createTableIfMissing: false, pruneSessionInterval: 60 });
  app.locals.sessionStore = store;
  app.use('/api', session({ name: 'birthday.sid', secret: sessionSecret, store,
    resave: false, saveUninitialized: false, rolling: true,
    cookie: { httpOnly: true, sameSite: 'strict', secure: secureCookies, maxAge: IDLE_MS } }));
  app.use('/api', (req, res, next) => {
    if (req.session.user && (now() - req.session.startedAt >= ABSOLUTE_MS || now() - req.session.lastSeen >= IDLE_MS)) {
      return req.session.destroy(err => err ? next(err) : res.status(401).json({ error: 'Session expired' }));
    }
    if (req.session.user) req.session.lastSeen = now();
    next();
  });
  const authenticated = (req, res, next) => req.session.user ? next() : res.status(401).json({ error: 'Sign in required' });
  app.use('/api/birthdays', authenticated);
  app.get('/api/auth/csrf', (req, res) => { req.session.csrf ??= csrf(); res.json({ csrfToken: req.session.csrf }); });
  app.use('/api', (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (req.method !== 'DELETE' && !req.is('application/json')) return res.status(415).json({ error: 'JSON required' });
    if (!equalToken(req.headers['x-csrf-token'], req.session.csrf)) return res.status(403).json({ error: 'Invalid CSRF token' });
    next();
  });
  const dummyHash = await argon2.hash(randomBytes(32), HASH_OPTIONS);
  let activeHashes = 0;
  app.post('/api/auth/login', limiter(limits.login ?? 10), wrap(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid sign-in request' });
    if (activeHashes >= 2) return res.status(429).json({ error: 'Sign-in busy; try again later' });
    activeHashes++;
    let user, matches;
    try {
      const { rows } = await pool.query('SELECT id,username,password_hash,enabled FROM users WHERE username=$1', [parsed.data.username]);
      user = rows[0];
      matches = await argon2.verify(user?.password_hash ?? dummyHash, parsed.data.password);
    } finally { activeHashes--; }
    if (!user?.enabled || !matches) { logger.warn({ event: 'login_failed', requestId: req.id });
      return res.status(401).json({ error: 'Invalid username or password' }); }
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.user = { id: user.id, username: user.username };
    req.session.startedAt = req.session.lastSeen = now();
    req.session.csrf = csrf();
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    logger.info({ event: 'login_success', actor: user.id, requestId: req.id });
    res.json({ user: req.session.user, csrfToken: req.session.csrf });
  }));
  app.get('/api/auth/me', authenticated, (req, res) => res.json({ user: req.session.user, csrfToken: req.session.csrf }));
  app.post('/api/auth/logout', authenticated, (req, res, next) => req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie('birthday.sid', { httpOnly: true, sameSite: 'strict', secure: secureCookies });
    res.status(204).end();
  }));
  const readLimit = limiter(limits.read ?? 120), writeLimit = limiter(limits.write ?? 60);
  app.use('/api/birthdays', (req, res, next) => (req.method === 'GET' ? readLimit : writeLimit)(req, res, next), birthdayRouter(pool, logger));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  if (staticDirectory) {
    app.use(express.static(staticDirectory));
    app.get('*', (req, res) => res.sendFile(path.join(staticDirectory, 'index.html')));
  }
  app.use((err, req, res, next) => {
    // Never log request bodies, SQL detail fields, passwords or session cookies.
    logger.error({ event: 'request_failed', requestId: req.id, code: err.code,
      type: err.type, stack: err.stack?.split('\n').slice(1).join('\n') }, 'Request failed');
    const status = err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'Request failed' : 'Invalid request', requestId: req.id });
  });
  return app;
}
