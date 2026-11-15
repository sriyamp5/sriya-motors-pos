import { useState } from 'react';
import { Receipt, TrendingUp, Wallet, Coins } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '@shared/constants.js';
import { useApi } from '@/hooks/useApi.js';
import { useDebounce } from '@/hooks/useCommon.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { formatDateTime, formatMoney, todayIso, daysAgoIso } from '@/lib/format.js';
import {
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  StatCard,
  Switch,
} from '@/components/ui/index.js';
import { SaleDetailModal } from './SaleDetailModal.jsx';
import { PaymentBadge, SaleStatusBadge } from './saleLabels.jsx';

const RANGES = [
  { value: 'today', label: 'Today', from: () => todayIso() },
  { value: '7d', label: 'Last 7 days', from: () => daysAgoIso(6) },
  { value: '30d', label: 'Last 30 days', from: () => daysAgoIso(29) },
  { value: 'custom', label: 'Custom range' },
];

export function SalesPage() {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('today');
  const [customFrom, setCustomFrom] = useState(daysAgoIso(7));
  const [customTo, setCustomTo] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [overriddenOnly, setOverriddenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const debouncedSearch = useDebounce(search);

  const preset = RANGES.find((r) => r.value === range);
  const from = range === 'custom' ? customFrom : preset.from();
  const to = range === 'custom' ? customTo : todayIso();

  const { data, loading, error, reload } = useApi('/sales', {
    search: debouncedSearch,
    from: debouncedSearch ? undefined : from,
    to: debouncedSearch ? undefined : to,
    paymentMethod,
    overriddenOnly,
    page,
    pageSize: 25,
  });

  const resetPage = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const columns = [
    { key: 'invoice', header: 'Invoice', render: (s) => <span className="mono strong">{s.invoiceNo}</span> },
    { key: 'date', header: 'Date', render: (s) => <span className="nowrap">{formatDateTime(s.createdAt)}</span> },
    {
      key: 'customer',
      header: 'Customer',
      render: (s) =>
        s.customerName ? (
          <div>
            <div>{s.customerName}</div>
            <div className="small muted">{[s.customerPhone, s.vehicleNo].filter(Boolean).join(' · ')}</div>
          </div>
        ) : (
          <span className="muted">Walk-in{s.vehicleNo ? ` · ${s.vehicleNo}` : ''}</span>
        ),
    },
    { key: 'items', header: 'Items', align: 'right', render: (s) => <span className="num">{s.itemCount}</span> },
    { key: 'method', header: 'Payment', render: (s) => <PaymentBadge method={s.paymentMethod} /> },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <div className="row">
          <SaleStatusBadge status={s.status} />
          {s.hasPriceOverride && <Badge tone="accent">Price changed</Badge>}
        </div>
      ),
    },
    { key: 'cashier', header: 'Cashier', render: (s) => <span className="small">{s.cashierName}</span> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (s) => <span className="num strong">{formatMoney(s.totalAmount, false)}</span>,
    },
    ...(isAdmin
      ? [
          {
            key: 'profit',
            header: 'Profit',
            align: 'right',
            render: (s) => <span className="num text-success">{formatMoney(s.totalAmount - s.totalCost, false)}</span>,
          },
        ]
      : []),
  ];

  const summary = data?.summary;

  return (
    <div className="page">
      <PageHeader title="Sales history" description="Find an invoice to view, reprint or return items." />

      {summary && (
        <div className={isAdmin ? 'grid-3' : 'grid-2'}>
          <StatCard icon={Receipt} label="Invoices" value={summary.count} />
          <StatCard icon={Wallet} tone="accent" label="Sales value" value={formatMoney(summary.totalAmount)} />
          {isAdmin && (
            <StatCard icon={TrendingUp} tone="success" label="Gross profit" value={formatMoney(summary.grossProfit)} />
          )}
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={resetPage(setSearch)}
            placeholder="Invoice no, customer, phone, vehicle"
          />
          <select
            className="select"
            value={range}
            onChange={(e) => resetPage(setRange)(e.target.value)}
            disabled={Boolean(search)}
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {range === 'custom' && !search && (
            <>
              <input
                type="date"
                className="input"
                style={{ width: 160 }}
                value={customFrom}
                max={customTo}
                onChange={(e) => resetPage(setCustomFrom)(e.target.value)}
              />
              <span className="muted">to</span>
              <input
                type="date"
                className="input"
                style={{ width: 160 }}
                value={customTo}
                min={customFrom}
                max={todayIso()}
                onChange={(e) => resetPage(setCustomTo)(e.target.value)}
              />
            </>
          )}
          <select
            className="select"
            value={paymentMethod}
            onChange={(e) => resetPage(setPaymentMethod)(e.target.value)}
          >
            <option value="">All payments</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {isAdmin && (
            <span style={{ marginLeft: 'auto' }}>
              <Switch checked={overriddenOnly} onChange={resetPage(setOverriddenOnly)} label="Price changed only" />
            </span>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(s) => setSelected(s.id)}
          empty={<EmptyState icon={Coins} title="No sales found" message="Try a different date range or search." />}
        />
        {data && <Pagination {...data} onChange={setPage} />}
      </div>

      {selected && <SaleDetailModal saleId={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </div>
  );
}
