import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api/client.js';

/**
 * Loads data from a GET endpoint and reloads whenever `params` change.
 * Stale responses from earlier parameter sets are ignored.
 *
 * @returns {{ data, error, loading, reload, setData }}
 */
export function useApi(path, params, { enabled = true, keepPrevious = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const requestId = useRef(0);
  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(async () => {
    if (!enabled || !path) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    if (!keepPrevious) setData(null);
    try {
      const result = await api.get(path, JSON.parse(paramsKey));
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [path, paramsKey, enabled, keepPrevious]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
