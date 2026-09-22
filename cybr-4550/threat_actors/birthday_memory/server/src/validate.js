import { z } from 'zod';
const name = z.string().trim().min(1).max(80).regex(/^[^\x00-\x1f\x7f]+$/u);
const birthdate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
    && value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10);
});
export const birthdayInput = z.object({ firstName: name, lastName: name, birthdate,
  phone: z.string().trim().max(32).regex(/^[0-9+() .-]*$/).default(''),
  email: z.union([z.literal(''), z.email().max(254)]).default(''),
}).strict();
export const credentials = z.object({ username: z.string().min(3).max(64).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(1).max(128) }).strict();
const integer = (min, max, fallback) => z.string().regex(/^\d+$/)
  .transform(Number).pipe(z.number().int().min(min).max(max)).optional().transform(v => v ?? fallback);
export const listQuery = z.object({ page: integer(1, 10000, 1), limit: integer(1, 50, 25),
  q: z.string().trim().max(80).optional(), month: integer(1, 12, undefined) }).strict();
export const upcomingQuery = z.object({ page: integer(1, 10000, 1), limit: integer(1, 50, 25),
  days: integer(0, 366, 30) }).strict();
