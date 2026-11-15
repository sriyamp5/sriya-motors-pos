import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client.js';

/**
 * Loads active records for a dropdown, e.g. useOptions('/categories').
 * Returns [options, reload] where options are { value, label, raw }.
 */
export function useOptions(basePath, { params, labelOf = (r) => r.name, enabled = true } = {}) {
  const [options, setOptions] = useState([]);
  const paramsKey = JSON.stringify(params ?? {});

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const rows = await api.get(`${basePath}/options`, JSON.parse(paramsKey));
      setOptions(rows.map((r) => ({ value: String(r.id), label: labelOf(r), raw: r })));
    } catch {
      setOptions([]);
    }
    // labelOf is expected to be stable for a given call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, paramsKey, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return [options, load];
}
