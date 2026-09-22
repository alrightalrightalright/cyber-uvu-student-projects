import fs from 'node:fs';
import pg from 'pg';
pg.types.setTypeParser(1082, (value) => value);

export function required(name, env = process.env) {
  if (!env[name]) throw new Error(`Missing configuration: ${name}`);
  return env[name];
}
export function readSecret(name, env = process.env) {
  const value = fs.readFileSync(required(`${name}_FILE`, env), 'utf8').trim();
  if (value.length < 24) throw new Error(`${name} must have at least 24 characters`);
  return value;
}
export function databaseConfig(env = process.env) {
  return {
    host: required('PGHOST', env), port: Number(env.PGPORT || 5432),
    database: required('PGDATABASE', env), user: required('PGUSER', env),
    password: readSecret('PGPASSWORD', env),
    ssl: { ca: fs.readFileSync(required('PGSSLROOTCERT', env), 'utf8'), rejectUnauthorized: true },
    max: 10, connectionTimeoutMillis: 5000, statement_timeout: 5000, query_timeout: 6000,
  };
}
export function createPool(env) {
  const pool = new pg.Pool(databaseConfig(env));
  // Idle connections can fail during a database restart; avoid an unhandled event.
  pool.on('error', (error) => console.error(JSON.stringify({ event: 'idle_database_error', code: error.code })));
  return pool;
}
export const mapRow = (row) => ({ id: row.id, firstName: row.first_name,
  lastName: row.last_name, birthdate: row.birthdate, phone: row.phone,
  email: row.email, createdAt: row.created_at, updatedAt: row.updated_at });
