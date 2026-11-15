import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Truck } from 'lucide-react';
import { useApi } from '@/hooks/useApi.js';
import { useDebounce } from '@/hooks/useCommon.js';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format.js';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Loader,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
} from '@/components/ui/index.js';

function PurchaseDetailModal({ purchaseId, onClose }) {
  const { data, loading, error, reload } = useApi(`/purchases/${purchaseId}`);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={data ? `${data.grnNo} · ${data.supplierName}` : 'Goods received'}
      description={data ? `Received ${formatDate(data.purchaseDate)} · recorded by ${data.createdByName}` : null}
    >
      {loading && !data && <Loader />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="stack">
          {data.supplierInvoiceNo && (
            <div>
              Supplier invoice: <strong>{data.supplierInvoiceNo}</strong>
            </div>
          )}
          <div className="card">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Previous cost</th>
                  <th className="text-right">Buying price</th>
                  <th className="text-right">New selling</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="strong">{i.productName}</div>
                      <div className="small muted">{[i.itemCode, i.partNumber].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="text-right num">{i.quantity}</td>
                    <td className="text-right num muted">{formatMoney(i.previousCost, false)}</td>
                    <td className="text-right num">{formatMoney(i.unitCost, false)}</td>
                    <td className="text-right num">
                      {i.newSellingPrice ? formatMoney(i.newSellingPrice, false) : '—'}
                    </td>
                    <td className="text-right num strong">{formatMoney(i.lineTotal, false)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right">
                    Total
                  </td>
                  <td className="text-right num">{formatMoney(data.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {data.notes && <p className="text-2">{data.notes}</p>}
        </div>
      )}
    </Modal>
  );
}

export function PurchasesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const debouncedSearch = useDebounce(search);
  const { data, loading, error, reload } = useApi('/purchases', { search: debouncedSearch, page, pageSize: 25 });

  const columns = [
    { key: 'grn', header: 'GRN', render: (p) => <span className="mono strong">{p.grnNo}</span> },
    { key: 'date', header: 'Received', render: (p) => formatDate(p.purchaseDate) },
    { key: 'supplier', header: 'Supplier', render: (p) => <span className="strong">{p.supplierName}</span> },
    {
      key: 'invoice',
      header: 'Supplier invoice',
      render: (p) => p.supplierInvoiceNo ?? <span className="muted">—</span>,
    },
    { key: 'items', header: 'Items', align: 'right', render: (p) => <span className="num">{p.itemCount}</span> },
    {
      key: 'by',
      header: 'Recorded',
      render: (p) => (
        <span className="small">
          {p.createdByName} · {formatDateTime(p.createdAt)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (p) => <span className="num strong">{formatMoney(p.totalAmount, false)}</span>,
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Receive stock"
        description="Goods received from suppliers."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate('/purchases/new')}>
            Receive stock
          </Button>
        }
      />
      <div className="card">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="GRN no, supplier, supplier invoice"
          />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(p) => setSelected(p.id)}
          empty={
            <EmptyState
              icon={Truck}
              title="No deliveries recorded"
              action={
                <Button variant="primary" icon={Plus} onClick={() => navigate('/purchases/new')}>
                  Receive stock
                </Button>
              }
            />
          }
        />
        {data && <Pagination {...data} onChange={setPage} />}
      </div>
      {selected && <PurchaseDetailModal purchaseId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
