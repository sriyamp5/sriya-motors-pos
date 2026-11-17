import { useCallback, useRef, useState } from 'react';
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  User,
  Car,
  Phone,
  Eraser,
  CreditCard,
  PackagePlus,
  AlertTriangle,
} from 'lucide-react';
import { api } from '@/api/client.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner.js';
import { useHotkeys } from '@/hooks/useCommon.js';
import { formatMoney } from '@/lib/format.js';
import { lineNetTotal, toCents } from '@shared/money.js';
import { Button, ConfirmDialog, EmptyState, Badge } from '@/components/ui/index.js';
import { ProductSearch } from './ProductSearch.jsx';
import { CheckoutModal } from './CheckoutModal.jsx';
import { useCart } from './useCart.js';
import { ProductFormModal } from '@/features/products/ProductFormModal.jsx';

/** Selects the text of a focused number box so typing replaces it. */
const selectOnFocus = (e) => e.target.select();

function CartLine({ line, index, onChange, onRemove }) {
  const overridden = line.unitPrice !== '' && toCents(line.unitPrice) !== toCents(line.listPrice);
  const overStock = Number(line.quantity) > line.stockQty;
  const total = lineNetTotal(line.quantity, line.unitPrice, line.discount);

  const setQuantity = (value) => onChange(line.key, { quantity: Math.max(1, value) });

  return (
    <tr className={overStock ? 'row-warning' : ''}>
      <td className="muted num" style={{ width: 36 }}>
        {index + 1}
      </td>
      <td className="cart-item">
        <div className="strong truncate">{line.name}</div>
        <div className="small muted truncate">
          {[line.partNumber, line.brandName, line.itemCode].filter(Boolean).join(' · ')}
          {line.rackLocation && <> · Rack {line.rackLocation}</>}
        </div>
        {overStock && (
          <div className="small text-danger strong">
            <AlertTriangle size={12} style={{ verticalAlign: -1 }} /> Only {line.stockQty} in stock
          </div>
        )}
      </td>
      <td style={{ width: 124 }}>
        <input
          className="input input-num cart-input"
          value={line.unitPrice}
          inputMode="decimal"
          onFocus={selectOnFocus}
          onChange={(e) => onChange(line.key, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })}
          aria-label="Unit price"
        />
        {overridden && (
          <div className="price-note">
            <Badge tone="accent">Price changed</Badge>
            <span className="muted small num" title="System price">
              <s>{formatMoney(line.listPrice, false)}</s>
            </span>
          </div>
        )}
      </td>
      <td style={{ width: 122 }}>
        <div className="qty-control">
          <button
            type="button"
            onClick={() => setQuantity(Number(line.quantity) - 1)}
            aria-label="Decrease quantity"
            tabIndex={-1}
          >
            <Minus size={14} />
          </button>
          <input
            className="input input-num"
            value={line.quantity}
            inputMode="numeric"
            onFocus={selectOnFocus}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              onChange(line.key, { quantity: digits === '' ? '' : Number(digits) });
            }}
            onBlur={() => !line.quantity && setQuantity(1)}
            aria-label="Quantity"
          />
          <button
            type="button"
            onClick={() => setQuantity(Number(line.quantity) + 1)}
            aria-label="Increase quantity"
            tabIndex={-1}
          >
            <Plus size={14} />
          </button>
        </div>
      </td>
      <td style={{ width: 96 }}>
        <input
          className="input input-num cart-input"
          value={line.discount}
          placeholder="0.00"
          inputMode="decimal"
          onFocus={selectOnFocus}
          onChange={(e) => onChange(line.key, { discount: e.target.value.replace(/[^\d.]/g, '') })}
          aria-label="Discount"
        />
      </td>
      <td className="text-right strong num" style={{ width: 110 }}>
        {formatMoney(total, false)}
      </td>
      <td style={{ width: 44 }}>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={Trash2}
          onClick={() => onRemove(line.key)}
          aria-label="Remove item"
          tabIndex={-1}
        />
      </td>
    </tr>
  );
}

export function PosPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const {
    cart,
    totals,
    itemCount,
    problems,
    addProduct,
    updateLine,
    removeLine,
    setBillDiscount,
    setCustomer,
    clear,
    getCheckoutRef,
  } = useCart();
  const searchRef = useRef(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [newItemBarcode, setNewItemBarcode] = useState(null);
  const [showCustomer, setShowCustomer] = useState(Boolean(cart.customer.name || cart.customer.phone));

  const add = useCallback(
    (product) => {
      if (product.stockQty <= 0) {
        toast.warning('Out of stock', `"${product.name}" has no stock.`);
        return;
      }
      const inCart = cart.lines.filter((l) => l.productId === product.id).reduce((s, l) => s + Number(l.quantity), 0);
      if (inCart >= product.stockQty) {
        toast.warning('Not enough stock', `Only ${product.stockQty} of "${product.name}" available.`);
        return;
      }
      addProduct(product);
    },
    [addProduct, cart.lines, toast],
  );

  /** Looks up a scanned or typed code; offers to register unknown barcodes. */
  const lookupCode = useCallback(
    async (code) => {
      try {
        const { product } = await api.get(`/products/lookup/${encodeURIComponent(code)}`);
        if (product) {
          add(product);
          return;
        }
        if (isAdmin) {
          setNewItemBarcode(code);
        } else {
          toast.warning('Item not found', `No item has the code "${code}". Search by name, or ask an admin to add it.`);
        }
      } catch (error) {
        toast.fromError(error, 'Lookup failed');
      }
    },
    [add, isAdmin, toast],
  );

  const scannerEnabled = !checkoutOpen && !newItemBarcode && !confirmClear;
  useBarcodeScanner(lookupCode, { enabled: scannerEnabled });

  const openCheckout = () => {
    if (!cart.lines.length) {
      toast.info('The bill is empty', 'Scan or search for an item first.');
      return;
    }
    if (problems.length) {
      toast.warning('Please fix the bill', problems[0]);
      return;
    }
    setCheckoutOpen(true);
  };

  useHotkeys(
    {
      F2: (e) => {
        e.preventDefault();
        searchRef.current?.focus();
      },
      F9: (e) => {
        e.preventDefault();
        openCheckout();
      },
    },
    scannerEnabled,
  );

  const discountTotal = totals.itemDiscountTotal + totals.billDiscount;

  return (
    <div className="pos">
      <section className="pos-main">
        <ProductSearch ref={searchRef} onSelect={add} onCodeEntered={lookupCode} />

        <div className="card pos-cart">
          {cart.lines.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Scan an item to start the bill"
              message="Use the barcode scanner, or type a name, part number or vehicle model in the search box."
            />
          ) : (
            <div className="table-wrap">
              <table className="table cart-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Unit price</th>
                    <th>Qty</th>
                    <th>Discount</th>
                    <th className="text-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.lines.map((line, index) => (
                    <CartLine key={line.key} line={line} index={index} onChange={updateLine} onRemove={removeLine} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <aside className="pos-side">
        <div className="card pos-panel">
          <div className="row-between">
            <h3 className="row">
              <User size={17} className="muted" /> Customer
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setShowCustomer((v) => !v)}>
              {showCustomer ? 'Hide' : 'Add details'}
            </Button>
          </div>
          {showCustomer ? (
            <div className="stack-sm mt-2">
              <div className="input-group">
                <User size={15} />
                <input
                  className="input"
                  placeholder="Customer name"
                  value={cart.customer.name}
                  onChange={(e) => setCustomer({ name: e.target.value, id: null })}
                />
              </div>
              <div className="input-group">
                <Phone size={15} />
                <input
                  className="input"
                  placeholder="Phone (07XXXXXXXX)"
                  value={cart.customer.phone}
                  onChange={(e) => setCustomer({ phone: e.target.value, id: null })}
                />
              </div>
              <div className="input-group">
                <Car size={15} />
                <input
                  className="input"
                  placeholder="Vehicle number (e.g. CAB-1234)"
                  value={cart.customer.vehicleNo}
                  onChange={(e) => setCustomer({ vehicleNo: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
          ) : (
            <p className="small muted mt-1">Walk-in customer. Details are needed only for credit sales.</p>
          )}
        </div>

        <div className="card pos-panel pos-totals">
          <div className="total-row">
            <span>Items</span>
            <span className="num">{itemCount}</span>
          </div>
          <div className="total-row">
            <span>Subtotal</span>
            <span className="num">{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="total-row">
            <span>Bill discount</span>
            <input
              className="input input-num"
              style={{ width: 130, height: 34 }}
              placeholder="0.00"
              value={cart.billDiscount}
              inputMode="decimal"
              onFocus={selectOnFocus}
              onChange={(e) => setBillDiscount(e.target.value.replace(/[^\d.]/g, ''))}
              aria-label="Bill discount"
            />
          </div>
          {discountTotal > 0 && (
            <div className="total-row text-success">
              <span>Total discount</span>
              <span className="num">- {formatMoney(discountTotal)}</span>
            </div>
          )}
          <div className="grand-total">
            <span>Total</span>
            <span className="num">{formatMoney(totals.total)}</span>
          </div>
          <Button
            variant="accent"
            size="xl"
            block
            icon={CreditCard}
            onClick={openCheckout}
            disabled={!cart.lines.length}
          >
            Charge{' '}
            <span className="kbd" style={{ marginLeft: 6 }}>
              F9
            </span>
          </Button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <Button
              variant="ghost"
              size="sm"
              icon={Eraser}
              onClick={() => setConfirmClear(true)}
              disabled={!cart.lines.length}
            >
              Clear bill
            </Button>
            <span className="small muted">F2 search · F9 charge</span>
          </div>
        </div>

        {isAdmin && (
          <Button variant="soft" icon={PackagePlus} onClick={() => setNewItemBarcode('')}>
            Add a new item
          </Button>
        )}
      </aside>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        totals={totals}
        getCheckoutRef={getCheckoutRef}
        onCustomerChange={setCustomer}
        onCompleted={() => {
          clear();
          setShowCustomer(false);
        }}
        onFinished={() => searchRef.current?.focus()}
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clear();
          searchRef.current?.focus();
        }}
        title="Clear this bill?"
        message="All items on the current bill will be removed."
        confirmLabel="Clear bill"
        danger
      />

      {newItemBarcode !== null && (
        <ProductFormModal
          open
          initialBarcode={newItemBarcode}
          onClose={() => setNewItemBarcode(null)}
          onSaved={(product) => {
            setNewItemBarcode(null);
            add(product);
          }}
        />
      )}
    </div>
  );
}
