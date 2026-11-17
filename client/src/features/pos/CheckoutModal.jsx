import { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CreditCard, BookUser, CheckCircle2, Printer, ScanBarcode, Search } from 'lucide-react';
import { createSaleSchema, toFieldErrors } from '@shared/schemas/index.js';
import { PAYMENT_METHODS } from '@shared/constants.js';
import { lineNetTotal, toCents, fromCents } from '@shared/money.js';
import { api } from '@/api/client.js';
import { useToast } from '@/context/ToastContext.jsx';
import { useShopSettings } from '@/context/SettingsContext.jsx';
import { useDebounce } from '@/hooks/useCommon.js';
import { formatMoney } from '@/lib/format.js';
import { buildReceiptHtml } from '@/lib/receipt.js';
import { printDocument } from '@/lib/printing.js';
import { Alert, Button, Modal, MoneyInput, Segmented, Switch, TextInput } from '@/components/ui/index.js';

const NOTE_STEPS = [100, 500, 1000, 5000];

/** Suggested cash amounts: exact, then rounded up to common note values. */
function quickCashAmounts(total) {
  const amounts = new Set([total]);
  for (const step of NOTE_STEPS) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) amounts.add(rounded);
  }
  return [...amounts].slice(0, 4);
}

/** Customer picker for credit sales: search existing accounts or enter a new one. */
function CreditCustomer({ customer, onChange, errors }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const debounced = useDebounce(query.trim(), 250);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([]);
      return;
    }
    api
      .get('/customers', { search: debounced, pageSize: 5 })
      .then((r) => setResults(r.items))
      .catch(() => setResults([]));
  }, [debounced]);

  if (customer.id) {
    return (
      <div className="card" style={{ padding: 12 }}>
        <div className="row-between">
          <div>
            <div className="strong">{customer.name}</div>
            <div className="small muted">{customer.phone}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onChange({ id: null, name: '', phone: '' })}>
            Change
          </Button>
        </div>
        {customer.balance > 0 && (
          <div className="small text-warning mt-1">Current balance due: {formatMoney(customer.balance)}</div>
        )}
      </div>
    );
  }

  return (
    <div className="stack-sm">
      <div className="input-group">
        <Search size={15} />
        <input
          className="input"
          placeholder="Find existing customer by name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {results.length > 0 && (
        <div className="card" style={{ padding: 4 }}>
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="menu-item"
              onClick={() => {
                onChange({ id: c.id, name: c.name, phone: c.phone ?? '', balance: c.creditBalance });
                setQuery('');
              }}
            >
              <span className="grow">{c.name}</span>
              <span className="small muted">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
      <div className="small muted">or enter a new customer:</div>
      <div className="grid-2">
        <TextInput
          label="Customer name"
          required
          value={customer.name}
          onChange={(e) => onChange({ name: e.target.value })}
          error={errors.customerName}
        />
        <TextInput
          label="Phone"
          required
          value={customer.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          error={errors.customerPhone}
          placeholder="07XXXXXXXX"
        />
      </div>
    </div>
  );
}

export function CheckoutModal({
  open,
  onClose,
  cart,
  totals,
  getCheckoutRef,
  onCustomerChange,
  onCompleted,
  onFinished,
}) {
  const toast = useToast();
  const { settings } = useShopSettings();
  const [method, setMethod] = useState(PAYMENT_METHODS.CASH);
  const [tendered, setTendered] = useState('');
  const [cardReference, setCardReference] = useState('');
  const [printReceipt, setPrintReceipt] = useState(true);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const tenderedRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMethod(PAYMENT_METHODS.CASH);
    setTendered('');
    setCardReference('');
    setErrors({});
    setSubmitError(null);
    setCompletedSale(null);
  }, [open]);

  const total = totals.total;
  const tenderedValue = tendered === '' ? total : Number(tendered);
  const changeCents = toCents(tenderedValue) - toCents(total);
  const quickAmounts = useMemo(() => quickCashAmounts(total), [total]);

  // Buying prices are only known for admins; for cashiers the server enforces the minimum price.
  const lossCents = useMemo(() => {
    if (cart.lines.some((l) => l.unitCost === undefined)) return 0;
    const costCents = cart.lines.reduce((sum, l) => sum + toCents(l.unitCost) * Number(l.quantity), 0);
    return Math.max(0, costCents - toCents(total));
  }, [cart.lines, total]);

  const print = async (sale, reprint = false) => {
    const result = await printDocument(buildReceiptHtml(sale, settings, { reprint }), {
      printerName: settings.receiptPrinter,
      silent: settings.silentPrint,
    });
    if (!result.success && result.reason !== 'cancelled') {
      toast.warning(
        'Receipt not printed',
        `${result.reason ?? 'Printer error'}. The sale is saved — you can reprint from Sales history.`,
      );
    }
  };

  const submit = async () => {
    if (submitting || completedSale) return;
    const payload = {
      items: cart.lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        discount: Number(l.discount) || 0,
      })),
      billDiscount: Number(cart.billDiscount) || 0,
      paymentMethod: method,
      amountTendered: method === PAYMENT_METHODS.CASH ? tenderedValue : 0,
      cardReference: method === PAYMENT_METHODS.CARD ? cardReference : '',
      customerId: cart.customer.id ?? '',
      customerName: cart.customer.name,
      customerPhone: cart.customer.phone,
      vehicleNo: cart.customer.vehicleNo,
      clientRef: getCheckoutRef?.(),
    };

    const parsed = createSaleSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error);
      setErrors(fieldErrors);
      setSubmitError(Object.values(fieldErrors)[0]);
      return;
    }
    if (method === PAYMENT_METHODS.CASH && changeCents < 0) {
      setErrors({ amountTendered: 'Cash received is less than the total' });
      tenderedRef.current?.focus();
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const sale = await api.post('/sales', parsed.data);
      setCompletedSale(sale);
      onCompleted();
      if (printReceipt) print(sale);
    } catch (error) {
      // After a lost connection it is safe to press Confirm again: the same bill is never saved twice.
      const lostConnection = error.code === 'NETWORK' || error.code === 'TIMEOUT';
      setSubmitError(
        lostConnection
          ? `${error.message} When the connection is back, press Confirm again. The bill will not be saved twice.`
          : error.message,
      );
      if (error.fields) setErrors(error.fields);
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    onClose();
    onFinished?.();
  };

  const onKeyDown = (event) => {
    if (event.key !== 'Enter' || event.target.tagName === 'BUTTON') return;
    event.preventDefault();
    if (completedSale) finish();
    else submit();
  };

  if (completedSale) {
    return (
      <Modal open={open} onClose={finish} title="Sale completed" size="sm">
        <div className="stack text-center" onKeyDown={onKeyDown}>
          <CheckCircle2 size={56} style={{ color: 'var(--success)', margin: '0 auto' }} />
          <div>
            <div className="muted">Invoice</div>
            <div className="strong" style={{ fontSize: 20 }}>
              {completedSale.invoiceNo}
            </div>
          </div>
          <div className="grid-2">
            <div className="card" style={{ padding: 12 }}>
              <div className="small muted">Total</div>
              <div className="strong num" style={{ fontSize: 18 }}>
                {formatMoney(completedSale.totalAmount)}
              </div>
            </div>
            <div className="card" style={{ padding: 12, background: 'var(--success-soft)' }}>
              <div className="small muted">{completedSale.paymentMethod === 'CASH' ? 'Change to give' : 'Payment'}</div>
              <div className="strong num" style={{ fontSize: 18 }}>
                {completedSale.paymentMethod === 'CASH'
                  ? formatMoney(completedSale.changeAmount)
                  : completedSale.paymentMethod}
              </div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Button icon={Printer} onClick={() => print(completedSale, true)}>
              Print again
            </Button>
            <Button variant="primary" icon={ScanBarcode} onClick={finish} data-autofocus>
              New sale (Enter)
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={submitting}
      title="Review bill and take payment"
      description="Check the items and total with the customer before confirming."
      size="xl"
      footer={
        <>
          <Switch checked={printReceipt} onChange={setPrintReceipt} label="Print receipt" />
          <span className="grow" />
          <Button onClick={onClose} disabled={submitting}>
            Back to bill
          </Button>
          <Button variant="accent" size="lg" icon={CheckCircle2} onClick={submit} loading={submitting}>
            Confirm {formatMoney(total)}
          </Button>
        </>
      }
    >
      <div className="checkout" onKeyDown={onKeyDown}>
        <div className="checkout-bill">
          <div className="table-wrap">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <div className="strong">{l.name}</div>
                      {Number(l.discount) > 0 && (
                        <div className="small text-success">Discount - {formatMoney(l.discount, false)}</div>
                      )}
                    </td>
                    <td className="text-right num">{l.quantity}</td>
                    <td className="text-right num">{formatMoney(l.unitPrice, false)}</td>
                    <td className="text-right num strong">
                      {formatMoney(lineNetTotal(l.quantity, l.unitPrice, l.discount), false)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="checkout-summary">
            <div className="total-row">
              <span>Subtotal</span>
              <span className="num">{formatMoney(totals.subtotal)}</span>
            </div>
            {totals.itemDiscountTotal > 0 && (
              <div className="total-row text-success">
                <span>Item discounts</span>
                <span className="num">- {formatMoney(totals.itemDiscountTotal)}</span>
              </div>
            )}
            {totals.billDiscount > 0 && (
              <div className="total-row text-success">
                <span>Bill discount</span>
                <span className="num">- {formatMoney(totals.billDiscount)}</span>
              </div>
            )}
            <div className="grand-total">
              <span>Total</span>
              <span className="num">{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        <div className="checkout-pay stack">
          <Segmented
            value={method}
            onChange={(value) => {
              setMethod(value);
              setErrors({});
              setSubmitError(null);
            }}
            options={[
              { value: PAYMENT_METHODS.CASH, label: 'Cash', icon: Banknote },
              { value: PAYMENT_METHODS.CARD, label: 'Card', icon: CreditCard },
              { value: PAYMENT_METHODS.CREDIT, label: 'Credit', icon: BookUser },
            ]}
          />

          {method === PAYMENT_METHODS.CASH && (
            <>
              <MoneyInput
                ref={tenderedRef}
                label="Cash received"
                size="lg"
                placeholder={total.toFixed(2)}
                value={tendered}
                onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ''))}
                error={errors.amountTendered}
                data-autofocus
                data-scanner="ignore"
              />
              <div className="row-wrap">
                {quickAmounts.map((amount) => (
                  <Button key={amount} size="sm" variant="soft" onClick={() => setTendered(String(amount))}>
                    {amount === total ? 'Exact' : formatMoney(amount, false)}
                  </Button>
                ))}
              </div>
              <div className={`change-box ${changeCents < 0 ? 'short' : ''}`}>
                <span>{changeCents < 0 ? 'Short by' : 'Change'}</span>
                <span className="num">{formatMoney(Math.abs(fromCents(changeCents)))}</span>
              </div>
            </>
          )}

          {method === PAYMENT_METHODS.CARD && (
            <TextInput
              label="Card reference (optional)"
              placeholder="Last 4 digits or approval code"
              value={cardReference}
              onChange={(e) => setCardReference(e.target.value)}
              error={errors.cardReference}
              data-scanner="ignore"
            />
          )}

          {method === PAYMENT_METHODS.CREDIT && (
            <>
              <Alert tone="warning">The full amount is added to the customer’s balance.</Alert>
              <CreditCustomer customer={cart.customer} onChange={onCustomerChange} errors={errors} />
            </>
          )}

          {lossCents > 0 && (
            <Alert tone="warning" title="This bill is below the buying price">
              The shop loses {formatMoney(fromCents(lossCents))} on this sale. Check the prices and discounts before
              confirming.
            </Alert>
          )}

          {submitError && (
            <Alert tone="danger" title="Could not complete the sale">
              {submitError}
            </Alert>
          )}
        </div>
      </div>
    </Modal>
  );
}
