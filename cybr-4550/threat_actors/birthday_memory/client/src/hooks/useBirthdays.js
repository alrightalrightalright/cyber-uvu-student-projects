import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Loads a bounded page. Search, calendar and statistics describe the displayed page.
 */
export function useBirthdays() {
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.list({ page, limit: 25 });
      setBirthdays(data.items);
      setHasMore(data.hasMore);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (payload) => {
    const created = await api.create(payload);
    await refresh();
    return created;
  }, [refresh]);

  const update = useCallback(async (id, payload) => {
    const updated = await api.update(id, payload);
    setBirthdays((current) =>
      sortByCelebration(current.map((entry) => (entry.id === id ? updated : entry))),
    );
    return updated;
  }, []);

  const remove = useCallback(async (id) => {
    await api.remove(id);
    await refresh();
  }, [refresh]);

  return { birthdays, loading, error, refresh, create, update, remove, page, setPage, hasMore };
}

function sortByCelebration(list) {
  return [...list].sort((a, b) => {
    const aKey = a.birthdate.slice(5);
    const bKey = b.birthdate.slice(5);
    return aKey.localeCompare(bKey) || a.firstName.localeCompare(b.firstName);
  });
}
