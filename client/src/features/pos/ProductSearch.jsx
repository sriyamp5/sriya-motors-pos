import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ScanBarcode, Loader2, MapPin } from 'lucide-react';
import { api } from '@/api/client.js';
import { useDebounce } from '@/hooks/useCommon.js';
import { formatMoney } from '@/lib/format.js';
import { Badge } from '@/components/ui/index.js';

/**
 * Search box for the till. Typing shows matching items (name, part number,
 * brand, vehicle, rack); pressing Enter on an exact code adds that item
 * directly, which is also how a scanner or a typed barcode works.
 */
export const ProductSearch = forwardRef(function ProductSearch(
  {
    onSelect,
    onCodeEntered,
    allowOutOfStock = false,
    placeholder = 'Scan barcode, or search by name, part number, brand or vehicle',
    autoFocus = true,
  },
  ref,
) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const debounced = useDebounce(query.trim(), 220);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => setQuery(''),
  }));

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api
      .get('/products', { search: debounced, pageSize: 8 })
      .then((r) => {
        if (!active) return;
        setResults(r.items);
        setHighlight(0);
        setOpen(true);
      })
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced]);

  const choose = (product) => {
    onSelect(product);
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const text = query.trim();
      if (!text) return;
      // An open list with a highlighted row wins; otherwise treat the text as a code.
      if (open && results[highlight] && debounced === text) {
        choose(results[highlight]);
      } else {
        setQuery('');
        setOpen(false);
        onCodeEntered(text);
      }
    }
  };

  return (
    <div className="pos-search">
      <div className="input-group">
        <ScanBarcode size={20} />
        <input
          ref={inputRef}
          className="input input-lg"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
        <span className="input-suffix row">
          {loading ? <Loader2 size={18} className="spin muted" /> : <span className="kbd">F2</span>}
        </span>
      </div>

      {open && debounced.length >= 2 && (
        <div className="pos-results" role="listbox">
          {results.length === 0 && !loading && <div className="pos-result-empty">No items match “{debounced}”.</div>}
          {results.map((p, index) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={index === highlight}
              className={`pos-result ${index === highlight ? 'active' : ''}`}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              disabled={!allowOutOfStock && p.stockQty <= 0}
            >
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="strong truncate">{p.name}</div>
                <div className="small muted truncate">
                  {[p.partNumber, p.brandName, p.fitsVehicles].filter(Boolean).join(' · ') || p.itemCode}
                </div>
              </div>
              {p.rackLocation && (
                <span className="small muted nowrap">
                  <MapPin size={12} style={{ verticalAlign: -1 }} /> {p.rackLocation}
                </span>
              )}
              <Badge tone={p.stockQty <= 0 ? 'danger' : p.isLowStock ? 'warning' : 'success'}>
                {p.stockQty <= 0 ? 'Out of stock' : `${p.stockQty} in stock`}
              </Badge>
              <span className="strong num nowrap" style={{ width: 110, textAlign: 'right' }}>
                {formatMoney(p.sellingPrice)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
