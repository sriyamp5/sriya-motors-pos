import { useState } from 'react';
import { Undo2, Search } from 'lucide-react';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useDebounce } from '@/hooks/useCommon.js';
import { useToast } from '@/context/ToastContext.jsx';
import { formatDateTime, formatMoney } from '@/lib/format.js';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
} from '@/components/ui/index.js';
import { SaleDetailModal } from './SaleDetailModal.jsx';

export function ReturnsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [finding, setFinding] = useState(false);
  const [saleId, setSaleId] = useState(null);
  const debouncedSearch = useDebounce(search);
  const { data, loading, error, reload } = useApi('/returns', { search: debouncedSearch, page, pageSize: 25 });

  /** Opens an invoice by its number so items can be returned. */
  const findInvoice = async (event) => {
    event.preventDefault();
    const raw = invoiceNo.trim().toUpperCase();
    if (!raw) return;
    const normalized = /^\d+$/.test(raw) ? `INV-${raw.padStart(6, '0')}` : raw;
    setFinding(true);
    try {
      const sale = await api.get(`/sales/invoice/${encodeURIComponent(normalized)}`);
      setSaleId(sale.id);
      setInvoiceNo('');
    } catch (err) {
      toast.fromError(err, 'Invoice not found');
    } finally {
      setFinding(false);
    }
  };

  const columns = [
    { key: 'no', header: 'Return', render: (r) => <span className="mono strong">{r.returnNo}</span> },
    { key: 'date', header: 'Date', render: (r) => formatDateTime(r.createdAt) },
    { key: 'invoice', header: 'Invoice', render: (r) => <span className="mono">{r.invoiceNo}</span> },
    { key: 'customer', header: 'Customer', render: (r) => r.customerName || <span className="muted">Walk-in</span> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="small">{r.reason}</span> },
    { key: 'method', header: 'Refund', render: (r) => <Badge>{r.refundMethod}</Badge> },
    { key: 'by', header: 'By', render: (r) => <span className="small">{r.createdByName}</span> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => <span className="num strong text-danger">{formatMoney(r.refundAmount, false)}</span>,
    },
  ];

  return (
    <div className="page">
      <PageHeader title="Returns" description="Process a customer return from the original invoice." />

      <Card title="Start a return" icon={Undo2}>
        <form className="row" onSubmit={findInvoice}>
          <div className="input-group" style={{ width: 340 }}>
            <Search size={16} />
            <input
              className="input"
              placeholder="Invoice number, e.g. INV-000123 or 123"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" loading={finding}>
            Find invoice
          </Button>
          <span className="small muted">The invoice number is printed at the top of the receipt.</span>
        </form>
      </Card>

      <div className="card">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Return no, invoice no, customer"
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(r) => setSaleId(r.saleId)}
          empty={<EmptyState icon={Undo2} title="No returns yet" />}
        />
        {data && <Pagination {...data} onChange={setPage} />}
      </div>

      {saleId && <SaleDetailModal saleId={saleId} onClose={() => setSaleId(null)} onChanged={reload} />}
    </div>
  );
}
