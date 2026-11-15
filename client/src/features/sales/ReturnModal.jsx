import { useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { createReturnSchema, toFieldErrors } from '@shared/schemas/index.js';
import { toCents, fromCents } from '@shared/money.js';
import { api } from '@/api/client.js';
import { useToast } from '@/context/ToastContext.jsx';
import { formatMoney } from '@/lib/format.js';
import { Alert, Button, Modal, SelectInput, TextInput } from '@/components/ui/index.js';
import { refundLabel, refundOptionsFor } from './saleLabels.jsx';

const REASONS = ['Wrong part', 'Does not fit the vehicle', 'Defective / damaged', 'Customer changed mind', 'Other'];

/** Estimated refund per unit: the line's share of the bill after all discounts. */
function unitRefund(item, sale) {
  const base = toCents(sale.subtotal) - toCents(sale.itemDiscountTotal);
  const billShare = base > 0 ? (toCents(sale.billDiscount) * toCents(item.lineTotal)) / base : 0;
  return (toCents(item.lineTotal) - billShare) / item.quantity;
}

export function ReturnModal({ sale, onClose, onCompleted }) {
  const toast = useToast();
  const returnable = sale.items.filter((i) => i.quantity > i.returnedQty);
  const refundOptions = refundOptionsFor(sale);
  const [quantities, setQuantities] = useState(() => Object.fromEntries(returnable.map((i) => [i.id, ''])));
  const [restock, setRestock] = useState(() => Object.fromEntries(returnable.map((i) => [i.id, true])));
  const [refundMethod, setRefundMethod] = useState(refundOptions[0]);
  const [reason, setReason] = useState(REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const refundTotal = useMemo(
    () =>
      fromCents(
        Math.round(
          returnable.reduce((sum, item) => sum + unitRefund(item, sale) * (Number(quantities[item.id]) || 0), 0),
        ),
      ),
    [quantities, returnable, sale],
  );

  const submit = async () => {
    const payload = {
      saleId: sale.id,
      refundMethod,
      reason: reason === 'Other' ? otherReason : reason,
      items: returnable
        .filter((i) => Number(quantities[i.id]) > 0)
        .map((i) => ({ saleItemId: i.id, quantity: Number(quantities[i.id]), restock: restock[i.id] })),
    };
    for (const item of returnable) {
      if (Number(quantities[item.id]) > item.quantity - item.returnedQty) {
        setErrors({ _form: `You can return at most ${item.quantity - item.returnedQty} of "${item.productName}".` });
        return;
      }
    }
    const parsed = createReturnSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await api.post('/returns', parsed.data);
      toast.success('Return recorded', `${result.returnNo}: refund ${formatMoney(result.refundAmount)}`);
      onCompleted();
    } catch (error) {
      setErrors({ _form: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const firstError = errors._form ?? errors.items ?? errors.reason ?? Object.values(errors)[0];

  return (
    <Modal
      open
      onClose={onClose}
      busy={submitting}
      size="lg"
      title={`Return items · ${sale.invoiceNo}`}
      description="Enter the quantity being returned. Untick “Back to stock” for damaged parts."
      footer={
        <>
          <span className="grow strong">
            Refund: <span className="num">{formatMoney(refundTotal)}</span>
          </span>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" icon={Undo2} onClick={submit} loading={submitting} disabled={refundTotal <= 0}>
            Confirm return
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="card">
          <table className="table table-compact">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Sold</th>
                <th className="text-right">Can return</th>
                <th style={{ width: 110 }}>Return qty</th>
                <th className="text-center">Back to stock</th>
                <th className="text-right">Refund</th>
              </tr>
            </thead>
            <tbody>
              {returnable.map((item) => {
                const max = item.quantity - item.returnedQty;
                const qty = Number(quantities[item.id]) || 0;
                return (
                  <tr key={item.id}>
                    <td className="strong">{item.productName}</td>
                    <td className="text-right num">{item.quantity}</td>
                    <td className="text-right num">{max}</td>
                    <td>
                      <input
                        className="input input-num"
                        style={{ height: 32 }}
                        inputMode="numeric"
                        placeholder="0"
                        value={quantities[item.id]}
                        onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value.replace(/\D/g, '') }))}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={restock[item.id]}
                        onChange={(e) => setRestock((r) => ({ ...r, [item.id]: e.target.checked }))}
                        style={{ width: 16, height: 16 }}
                      />
                    </td>
                    <td className="text-right num">
                      {qty ? formatMoney(fromCents(Math.round(unitRefund(item, sale) * qty)), false) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid-2">
          <SelectInput
            label="Refund method"
            value={refundMethod}
            onChange={(e) => setRefundMethod(e.target.value)}
            options={refundOptions.map((m) => ({ value: m, label: refundLabel(m) }))}
          />
          <SelectInput
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            options={REASONS.map((r) => ({ value: r, label: r }))}
          />
        </div>
        {reason === 'Other' && (
          <TextInput
            label="Describe the reason"
            required
            value={otherReason}
            onChange={(e) => setOtherReason(e.target.value)}
            error={errors.reason}
          />
        )}
        {firstError && <Alert tone="danger">{firstError}</Alert>}
      </div>
    </Modal>
  );
}
