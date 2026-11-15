import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button.jsx';
import { EmptyState, ErrorState, Loader } from './Feedback.jsx';

/**
 * Generic table.
 *
 * columns: [{ key, header, render?(row), align?: 'right'|'center', width?, className? }]
 */
export function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  onRowClick,
  rowKey = (row) => row.id,
  rowClassName,
  empty,
  footer,
  compact = false,
  maxHeight,
}) {
  if (error && !rows?.length) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !rows) return <Loader />;
  if (!rows?.length) return empty ?? <EmptyState title="Nothing here yet" />;

  return (
    <div className="table-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className={`table ${compact ? 'table-compact' : ''}`} style={{ opacity: loading ? 0.6 : 1 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.align ? `text-${col.align}` : ''}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={[onRowClick && 'clickable', rowClassName?.(row)].filter(Boolean).join(' ')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={[col.align && `text-${col.align}`, col.className].filter(Boolean).join(' ')}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, total, pageSize, onChange }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span>
        Showing <strong className="num">{from}</strong>–<strong className="num">{to}</strong> of{' '}
        <strong className="num">{total}</strong>
      </span>
      <div className="row">
        <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <span className="num">
          Page {page} of {totalPages}
        </span>
        <Button size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          Next
          <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
