import { useState } from 'react';
import { History } from 'lucide-react';
import { useApi } from '@/hooks/useApi.js';
import { useDebounce } from '@/hooks/useCommon.js';
import { formatDateTime } from '@/lib/format.js';
import { Badge, DataTable, EmptyState, PageHeader, Pagination, SearchInput } from '@/components/ui/index.js';

const ACTION_TONES = {
  PRICE_OVERRIDE: 'accent',
  PRODUCT_PRICE_CHANGED: 'accent',
  SALE_RETURN: 'warning',
  STOCK_ADJUSTED: 'warning',
  BACKUP_RESTORED: 'danger',
  USER_UPDATED: 'info',
  USER_CREATED: 'info',
  PASSWORD_RESET: 'info',
  LOGIN: 'default',
};

const actionLabel = (action) =>
  action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

/** Who did what and when: price changes, returns, stock corrections, user changes. */
export function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounce(search);
  const { data, loading, error, reload } = useApi('/audit-logs', { search: debounced, page, pageSize: 50 });

  return (
    <div className="page">
      <PageHeader title="Activity log" description="A permanent record of important actions in the system." />
      <div className="card">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search text, action or user name"
          />
        </div>
        <DataTable
          compact
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={<EmptyState icon={History} title="No activity found" />}
          columns={[
            {
              key: 'date',
              header: 'Date',
              render: (a) => <span className="nowrap">{formatDateTime(a.createdAt)}</span>,
            },
            { key: 'user', header: 'User', render: (a) => a.userName ?? <span className="muted">System</span> },
            {
              key: 'action',
              header: 'Action',
              render: (a) => <Badge tone={ACTION_TONES[a.action]}>{actionLabel(a.action)}</Badge>,
            },
            {
              key: 'summary',
              header: 'Details',
              render: (a) => (
                <div>
                  <div>{a.summary}</div>
                  {Array.isArray(a.details) && a.action === 'PRICE_OVERRIDE' && (
                    <div className="small muted">
                      {a.details.map((d) => `${d.item}: ${d.systemPrice} → ${d.chargedPrice}`).join(' · ')}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
        {data && <Pagination {...data} onChange={setPage} />}
      </div>
    </div>
  );
}
