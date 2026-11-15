import { useState } from 'react';
import { Plus, ClipboardList, X } from 'lucide-react';
import { z } from 'zod';
import {
  stockAdjustmentSchema,
  requiredId,
  requiredInteger,
  requiredText,
  optionalText,
} from '@shared/schemas/index.js';
import { ADJUSTMENT_REASONS } from '@shared/constants.js';
import { api } from '@/api/client.js';
import { useApi } from '@/hooks/useApi.js';
import { useForm } from '@/hooks/useForm.js';
import { useToast } from '@/context/ToastContext.jsx';
import { formatDateTime } from '@/lib/format.js';
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Pagination,
  Segmented,
  SelectInput,
  TextInput,
} from '@/components/ui/index.js';
import { ProductSearch } from '@/features/pos/ProductSearch.jsx';

/**
 * The form asks for a direction and a positive quantity, which is easier for
 * shop staff than a signed number, and converts them to the API shape.
 */
const adjustmentFormSchema = z
  .object({
    productId: requiredId('Item'),
    direction: z.enum(['add', 'remove']),
    quantity: requiredInteger('Quantity', { min: 1, max: 1_000_000 }),
    reason: requiredText('Reason', 60),
    note: optionalText('Note', 255),
  })
  .transform(({ direction, quantity, ...rest }) => ({
    ...rest,
    quantityChange: direction === 'remove' ? -quantity : quantity,
  }))
  .pipe(stockAdjustmentSchema);

/** Manual stock correction with a mandatory reason, e.g. after a stock count. */
function AdjustmentModal({ onClose, onSaved }) {
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const form = useForm(adjustmentFormSchema, {
    productId: '',
    direction: 'remove',
    quantity: '',
    reason: ADJUSTMENT_REASONS[0],
    note: '',
  });
  const { values } = form;

  const selectProduct = (p) => {
    setProduct(p);
    form.setValue('productId', String(p.id));
  };

  const lookupCode = async (code) => {
    try {
      const { product: found } = await api.get(`/products/lookup/${encodeURIComponent(code)}`);
      if (found) selectProduct(found);
      else toast.warning('Item not found', code);
    } catch (error) {
      toast.fromError(error);
    }
  };

  const change = values.quantity === '' ? null : (values.direction === 'remove' ? -1 : 1) * Number(values.quantity);
  const newBalance = product && change !== null ? product.stockQty + change : null;

  const save = form.handleSubmit(async (data) => {
    const result = await api.post('/stock/adjustments', data);
    toast.success('Stock adjusted', `${product.name}: new balance ${result.balanceAfter}`);
    onSaved();
  });

  return (
    <Modal
      open
      onClose={onClose}
      busy={form.submitting}
      title="Adjust stock"
      description="Use this to correct stock after a count, or to remove damaged or lost items."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={form.submitting} disabled={!product}>
            Save adjustment
          </Button>
        </>
      }
    >
      <div className="stack">
        {product ? (
          <div className="card" style={{ padding: 12 }}>
            <div className="row-between">
              <div>
                <div className="strong">{product.name}</div>
                <div className="small muted">
                  {[product.itemCode, product.partNumber].filter(Boolean).join(' · ')} · In stock:{' '}
                  <strong>{product.stockQty}</strong>
                </div>
              </div>
              <Button size="sm" variant="ghost" icon={X} onClick={() => setProduct(null)}>
                Change
              </Button>
            </div>
          </div>
        ) : (
          <Field label="Item" required error={form.errors.productId}>
            <ProductSearch
              onSelect={selectProduct}
              onCodeEntered={lookupCode}
              allowOutOfStock
              placeholder="Scan or search the item"
            />
          </Field>
        )}
        <div className="grid-2">
          <Field label="Change">
            <Segmented
              value={values.direction}
              onChange={(v) => form.setValue('direction', v)}
              options={[
                { value: 'remove', label: 'Remove' },
                { value: 'add', label: 'Add' },
              ]}
            />
          </Field>
          <TextInput label="Quantity" required inputMode="numeric" {...form.bind('quantity')} />
        </div>
        <SelectInput
          label="Reason"
          required
          options={ADJUSTMENT_REASONS.map((r) => ({ value: r, label: r }))}
          {...form.bind('reason')}
        />
        <TextInput label="Note" placeholder="Optional details" {...form.bind('note')} />
        {newBalance != null && (
          <Alert tone={newBalance < 0 ? 'danger' : 'info'}>
            Stock will change from <strong>{product.stockQty}</strong> to <strong>{newBalance}</strong>.
            {newBalance < 0 && ' Stock cannot go below zero.'}
          </Alert>
        )}
      </div>
    </Modal>
  );
}

export function AdjustmentsPage() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useApi('/stock/adjustments', { page, pageSize: 25 });

  const columns = [
    { key: 'date', header: 'Date', render: (a) => formatDateTime(a.createdAt) },
    {
      key: 'item',
      header: 'Item',
      render: (a) => (
        <div>
          <div className="strong">{a.productName}</div>
          <div className="small muted">{a.itemCode}</div>
        </div>
      ),
    },
    {
      key: 'qty',
      header: 'Change',
      align: 'right',
      render: (a) => (
        <span className={`num strong ${a.quantity > 0 ? 'text-success' : 'text-danger'}`}>
          {a.quantity > 0 ? `+${a.quantity}` : a.quantity}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'New balance',
      align: 'right',
      render: (a) => <span className="num">{a.balanceAfter}</span>,
    },
    { key: 'note', header: 'Reason', render: (a) => a.note },
    { key: 'user', header: 'By', render: (a) => <span className="small">{a.userName}</span> },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Stock adjustments"
        description="Corrections to stock outside of sales and deliveries. Every change is recorded."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
            New adjustment
          </Button>
        }
      />
      <div className="card">
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={<EmptyState icon={ClipboardList} title="No adjustments yet" />}
        />
        {data && <Pagination {...data} onChange={setPage} />}
      </div>
      {open && (
        <AdjustmentModal
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
