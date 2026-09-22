import { Router } from 'express';
import { mapRow } from './db.js';
import { decorate } from './dates.js';
import { birthdayInput, listQuery, upcomingQuery } from './validate.js';
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validId = (value) => /^[1-9]\d{0,9}$/.test(value) && Number(value) <= 2147483647;

export function birthdayRouter(pool, logger) {
  const router = Router();
  router.get('/', wrap(async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });
    const { page, limit, q, month } = parsed.data;
    const search = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null;
    const { rows } = await pool.query(`SELECT * FROM birthdays WHERE owner_id=$1
      AND ($2::text IS NULL OR first_name || ' ' || last_name ILIKE $2)
      AND ($3::int IS NULL OR EXTRACT(MONTH FROM birthdate)=$3)
      ORDER BY id LIMIT $4 OFFSET $5`, [req.session.user.id, search, month ?? null, limit + 1, (page - 1) * limit]);
    res.json({ items: rows.slice(0, limit).map(r => decorate(mapRow(r))), page, limit, hasMore: rows.length > limit });
  }));
  router.get('/upcoming', wrap(async (req, res) => {
    const parsed = upcomingQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });
    const { page, limit, days } = parsed.data;
    // SQL computes occurrences before LIMIT; February 29 clamps to February's last day.
    const { rows } = await pool.query(`WITH candidates AS (
      SELECT b.*, y.year, make_date(y.year, EXTRACT(MONTH FROM birthdate)::int, 1) AS month_start
      FROM birthdays b CROSS JOIN LATERAL generate_series(EXTRACT(YEAR FROM CURRENT_DATE)::int,
        EXTRACT(YEAR FROM CURRENT_DATE)::int+1) AS y(year) WHERE owner_id=$1
      ), occurrences AS (
      SELECT *, month_start + (LEAST(EXTRACT(DAY FROM birthdate)::int,
        EXTRACT(DAY FROM month_start + INTERVAL '1 month - 1 day')::int)-1) AS occurrence FROM candidates
      ), next_dates AS (SELECT id, MIN(occurrence) AS next_date FROM occurrences
        WHERE occurrence >= CURRENT_DATE GROUP BY id)
      SELECT b.* FROM birthdays b JOIN next_dates n USING(id)
      WHERE b.owner_id=$1 AND n.next_date <= CURRENT_DATE + $2::int
      ORDER BY n.next_date, b.id LIMIT $3 OFFSET $4`, [req.session.user.id, days, limit + 1, (page - 1) * limit]);
    res.json({ items: rows.slice(0, limit).map(r => decorate(mapRow(r))), page, limit, hasMore: rows.length > limit });
  }));
  async function mutate(req, res, action) {
    if (action !== 'create' && !validId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const parsed = action === 'delete' ? null : birthdayInput.safeParse(req.body);
    if (parsed && !parsed.success) return res.status(400).json({ error: 'Invalid birthday' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let result;
      const owner = req.session.user.id;
      if (action === 'delete') result = await client.query('DELETE FROM birthdays WHERE id=$1 AND owner_id=$2 RETURNING *', [req.params.id, owner]);
      else {
        const b = parsed.data;
        const values = [b.firstName, b.lastName, b.birthdate, b.phone, b.email, owner];
        result = action === 'create'
          ? await client.query(`INSERT INTO birthdays(first_name,last_name,birthdate,phone,email,owner_id)
              VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, values)
          : await client.query(`UPDATE birthdays SET first_name=$1,last_name=$2,birthdate=$3,phone=$4,email=$5,updated_at=NOW()
              WHERE owner_id=$6 AND id=$7 RETURNING *`, [...values, req.params.id]);
      }
      if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
      const target = result.rows[0].id;
      await client.query('INSERT INTO audit_events(actor_id,action,target_id,request_id) VALUES($1,$2,$3,$4)',
        [owner, action, target, req.id]);
      await client.query('COMMIT');
      logger.info({ event: 'birthday_mutation', actor: owner, action, target, requestId: req.id });
      return action === 'delete' ? res.status(204).end() : res.status(action === 'create' ? 201 : 200).json(decorate(mapRow(result.rows[0])));
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  router.post('/', wrap((req, res) => mutate(req, res, 'create')));
  router.put('/:id', wrap((req, res) => mutate(req, res, 'update')));
  router.delete('/:id', wrap((req, res) => mutate(req, res, 'delete')));
  return router;
}
