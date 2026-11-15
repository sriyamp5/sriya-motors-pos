import { useState } from 'react';
import { Plus, Pencil, History, Package, Power, Trash2, MapPin } from 'lucide-react';
import { PART_TYPE_LABELS } from '@shared/constants.js';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useDebounce } from '@/hooks/useCommon.js';
import { useOptions } from '@/hooks/useOptions.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { formatMoney } from '@/lib/format.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Switch,
} from '@/components/ui/index.js';
import { ProductFormModal } from './ProductFormModal.jsx';
import { ProductHistoryModal } from './ProductHistoryModal.jsx';

const STOCK_FILTERS = [
  { value: '', label: 'All stock levels' },
  { value: 'available', label: 'In stock' },
  { value: 'reorder', label: 'Low or out of stock' },
  { value: 'out', label: 'Out of stock' },
];

const SORTS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'newest', label: 'Newest first' },
  { value: 'stockAsc', label: 'Lowest stock first' },
  { value: 'priceDesc', label: 'Highest price first' },
];

export function StockBadge({ product }) {
  if (product.stockQty <= 0) return <Badge tone="danger">Out of stock</Badge>;
  if (product.isLowStock) return <Badge tone="warning">Low · {product.stockQty}</Badge>;
  return <Badge tone="success">{product.stockQty}</Badge>;
}

export function ProductsPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    categoryId: '',
    makeId: '',
    stock: '',
    sort: 'name',
    includeInactive: false,
  });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [history, setHistory] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const debouncedSearch = useDebounce(search);

  const [categories] = useOptions('/categories');
  const [makes] = useOptions('/vehicle-makes');

  const { data, loading, error, reload } = useApi('/products', {
    search: debouncedSearch,
    page,
    pageSize: 25,
    ...filters,
  });

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const toggleActive = async (product) => {
    try {
      await api.patch(`/products/${product.id}/active`, { isActive: !product.isActive });
      toast.success(product.isActive ? 'Item deactivated' : 'Item activated', product.name);
      reload();
    } catch (err) {
      toast.fromError(err);
      throw err;
    }
  };

  const remove = async (product) => {
    try {
      await api.delete(`/products/${product.id}`);
      toast.success('Item deleted', product.name);
      reload();
    } catch (err) {
      toast.fromError(err, 'Could not delete');
      throw err;
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Item',
      render: (p) => (
        <div style={{ minWidth: 230 }}>
          <div className="strong">{p.name}</div>
          <div className="small muted">{[p.itemCode, p.partNumber, p.barcode].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category / brand',
      render: (p) => (
        <div style={{ minWidth: 150 }}>
          <div>{p.categoryName}</div>
          <div className="small muted">{[p.brandName, PART_TYPE_LABELS[p.partType]].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    {
      key: 'fits',
      header: 'Fits',
      render: (p) => (
        <span
          className="small text-2 truncate"
          style={{ display: 'block', maxWidth: 220 }}
          title={p.fitsVehicles ?? ''}
        >
          {p.fitsVehicles || '—'}
        </span>
      ),
    },
    {
      key: 'rack',
      header: 'Rack',
      render: (p) =>
        p.rackLocation ? (
          <span className="nowrap">
            <MapPin size={12} className="muted" /> {p.rackLocation}
          </span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    ...(isAdmin
      ? [
          {
            key: 'cost',
            header: 'Buying',
            align: 'right',
            render: (p) => <span className="num muted">{formatMoney(p.costPrice, false)}</span>,
          },
        ]
      : []),
    {
      key: 'price',
      header: 'Selling',
      align: 'right',
      render: (p) => <span className="num strong">{formatMoney(p.sellingPrice, false)}</span>,
    },
    ...(isAdmin
      ? [
          {
            key: 'markup',
            header: 'Markup',
            align: 'right',
            render: (p) => (
              <span className="num small text-2">{p.markupPercent != null ? `${p.markupPercent}%` : '—'}</span>
            ),
          },
        ]
      : []),
    { key: 'stock', header: 'Stock', align: 'center', render: (p) => <StockBadge product={p} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          {isAdmin && (
            <>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={History}
                title="Stock history"
                onClick={() => setHistory(p)}
              />
              <Button size="sm" variant="ghost" iconOnly icon={Pencil} title="Edit" onClick={() => setEditing(p.id)} />
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={Power}
                title={p.isActive ? 'Deactivate' : 'Activate'}
                onClick={() => setConfirm({ type: 'active', product: p })}
              />
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={Trash2}
                title="Delete"
                onClick={() => setConfirm({ type: 'delete', product: p })}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Items"
        description={data ? `${data.total} item${data.total === 1 ? '' : 's'}` : 'Spare parts and stock levels'}
        actions={
          isAdmin && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
              Add item
            </Button>
          )
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
            placeholder="Name, part no, barcode, brand, vehicle, rack"
            autoFocus
          />
          <select
            className="select"
            value={filters.categoryId}
            onChange={(e) => setFilter('categoryId', e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select className="select" value={filters.makeId} onChange={(e) => setFilter('makeId', e.target.value)}>
            <option value="">All vehicles</option>
            {makes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select className="select" value={filters.stock} onChange={(e) => setFilter('stock', e.target.value)}>
            {STOCK_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select className="select" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {isAdmin && (
            <span style={{ marginLeft: 'auto' }}>
              <Switch
                checked={filters.includeInactive}
                onChange={(v) => setFilter('includeInactive', v)}
                label="Show inactive"
              />
            </span>
          )}
        </div>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={isAdmin ? (p) => setEditing(p.id) : undefined}
          rowClassName={(p) => (!p.isActive ? 'inactive' : '')}
          empty={
            <EmptyState
              icon={Package}
              title={search || filters.categoryId || filters.stock ? 'No matching items' : 'No items yet'}
              message={isAdmin ? 'Add your first spare part to start selling.' : 'Ask an admin to add items.'}
              action={
                isAdmin &&
                !search && (
                  <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
                    Add item
                  </Button>
                )
              }
            />
          }
        />
        {data && <Pagination {...data} onChange={setPage} />}
      </div>

      {editing && (
        <ProductFormModal
          open
          productId={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {history && (
        <ProductHistoryModal
          product={history}
          onClose={() => {
            setHistory(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={confirm?.type === 'active'}
        onClose={() => setConfirm(null)}
        onConfirm={() => toggleActive(confirm.product)}
        title={confirm?.product.isActive ? 'Deactivate item?' : 'Activate item?'}
        message={
          confirm?.product.isActive
            ? `"${confirm?.product.name}" will be hidden from the till. Its history is kept.`
            : `"${confirm?.product.name}" will be available for sale again.`
        }
        confirmLabel={confirm?.product.isActive ? 'Deactivate' : 'Activate'}
        danger={confirm?.product.isActive}
      />
      <ConfirmDialog
        open={confirm?.type === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm.product)}
        title="Delete item?"
        message={`"${confirm?.product.name}" will be permanently deleted. Items that were sold or received cannot be deleted — deactivate them instead.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
