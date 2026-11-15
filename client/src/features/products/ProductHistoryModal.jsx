import { useState } from 'react';
import { STOCK_MOVEMENT_LABELS } from '@shared/constants.js';
import { useApi } from '@/hooks/useApi.js';
import { formatDateTime, formatMoney } from '@/lib/format.js';
import { Badge, DataTable, Modal, Pagination, StatCard } from '@/components/ui/index.js';
import { Boxes, Tag, Wallet } from 'lucide-react';

const MOVEMENT_TONES = {
  OPENING: 'info',
  PURCHASE: 'success',
  SALE: 'primary',
  RETURN: 'accent',
  ADJUSTMENT: 'warning',
};

/** Every stock change for one item, newest first, with the running balance. */
export function ProductHistoryModal({ product, onClose }) {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApi(`/products/${product.id}/movements`, { page, pageSize: 15 });

  const columns = [
    { key: 'date', header: 'Date', render: (m) => <span className="nowrap">{formatDateTime(m.createdAt)}</span> },
    {
      key: 'type',
      header: 'Type',
      render: (m) => <Badge tone={MOVEMENT_TONES[m.movementType]}>{STOCK_MOVEMENT_LABELS[m.movementType]}</Badge>,
    },
    { key: 'ref', header: 'Reference', render: (m) => <span className="mono">{m.referenceNo ?? '—'}</span> },
    {
      key: 'qty',
      header: 'Change',
      align: 'right',
      render: (m) => (
        <span className={`num strong ${m.quantity > 0 ? 'text-success' : 'text-danger'}`}>
          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
        </span>
      ),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (m) => <span className="num">{m.balanceAfter}</span> },
    { key: 'note', header: 'Note', render: (m) => <span className="small text-2">{m.note ?? ''}</span> },
    { key: 'user', header: 'By', render: (m) => <span className="small">{m.userName}</span> },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={product.name}
      description={[product.itemCode, product.partNumber].filter(Boolean).join(' · ')}
    >
      <div className="stack">
        <div className="grid-3">
          <StatCard icon={Boxes} label="In stock" value={product.stockQty} sub={`Alert at ${product.reorderLevel}`} />
          <StatCard icon={Wallet} tone="accent" label="Buying price" value={formatMoney(product.costPrice)} />
          <StatCard
            icon={Tag}
            tone="success"
            label="Selling price"
            value={formatMoney(product.sellingPrice)}
            sub={product.markupPercent != null ? `Markup ${product.markupPercent}%` : null}
          />
        </div>
        <div className="card">
          <DataTable columns={columns} rows={data?.items} loading={loading} error={error} onRetry={reload} compact />
          {data && <Pagination {...data} onChange={setPage} />}
        </div>
      </div>
    </Modal>
  );
}
