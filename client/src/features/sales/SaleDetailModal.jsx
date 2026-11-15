import { useState } from 'react';
import { Printer, Undo2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useToast } from '@/context/ToastContext.jsx';
import { useShopSettings } from '@/context/SettingsContext.jsx';
import { formatDateTime, formatMoney } from '@/lib/format.js';
import { buildReceiptHtml } from '@/lib/receipt.js';
import { printDocument } from '@/lib/printing.js';
import { Badge, Button, ErrorState, Loader, Modal } from '@/components/ui/index.js';
import { PaymentBadge, SaleStatusBadge } from './saleLabels.jsx';
import { ReturnModal } from './ReturnModal.jsx';

export function SaleDetailModal({ saleId, onClose, onChanged }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { settings } = useShopSettings();
  const { data: sale, loading, error, reload } = useApi(`/sales/${saleId}`);
  const [returning, setReturning] = useState(false);

  const reprint = async () => {
    const result = await printDocument(buildReceiptHtml(sale, settings, { reprint: true }), {
      printerName: settings.receiptPrinter,
      silent: settings.silentPrint,
    });
    if (result.success) toast.success('Receipt sent to printer');
    else if (result.reason !== 'cancelled') toast.warning('Not printed', result.reason ?? 'Printer error');
  };

  const canReturn = sale && sale.items.some((i) => i.quantity > i.returnedQty);

  return (
    <>
      <Modal
        open={!returning}
        onClose={onClose}
        size="lg"
        title={sale ? `Invoice ${sale.invoiceNo}` : 'Invoice'}
        description={sale ? formatDateTime(sale.createdAt) : null}
        footer={
          sale && (
            <>
              <Button icon={Undo2} onClick={() => setReturning(true)} disabled={!canReturn}>
                Return items
              </Button>
              <Button variant="primary" icon={Printer} onClick={reprint}>
                Reprint
              </Button>
            </>
          )
        }
      >
        {loading && !sale && <Loader />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {sale && (
          <div className="stack">
            <div className="grid-2">
              <dl className="dl">
                <dt>Status</dt>
                <dd>
                  <SaleStatusBadge status={sale.status} />
                </dd>
                <dt>Payment</dt>
                <dd className="row">
                  <PaymentBadge method={sale.paymentMethod} />
                  {sale.cardReference && <span className="small muted">{sale.cardReference}</span>}
                </dd>
                <dt>Cashier</dt>
                <dd>{sale.cashierName}</dd>
              </dl>
              <dl className="dl">
                <dt>Customer</dt>
                <dd>{sale.customerName || 'Walk-in'}</dd>
                {sale.customerPhone && (
                  <>
                    <dt>Phone</dt>
                    <dd>{sale.customerPhone}</dd>
                  </>
                )}
                {sale.vehicleNo && (
                  <>
                    <dt>Vehicle</dt>
                    <dd>{sale.vehicleNo}</dd>
                  </>
                )}
              </dl>
            </div>

            <div className="card">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                    {isAdmin && <th className="text-right">Cost</th>}
                    <th className="text-right">Discount</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="strong">{item.productName}</div>
                        <div className="small muted">
                          {[item.itemCode, item.partNumber].filter(Boolean).join(' · ')}
                        </div>
                        <div className="row-wrap mt-1">
                          {item.priceOverridden && (
                            <Badge tone="accent">
                              System price {formatMoney(item.listPrice, false)} → charged{' '}
                              {formatMoney(item.unitPrice, false)}
                            </Badge>
                          )}
                          {item.returnedQty > 0 && <Badge tone="warning">{item.returnedQty} returned</Badge>}
                        </div>
                      </td>
                      <td className="text-right num">{item.quantity}</td>
                      <td className="text-right num">{formatMoney(item.unitPrice, false)}</td>
                      {isAdmin && <td className="text-right num muted">{formatMoney(item.unitCost, false)}</td>}
                      <td className="text-right num">{item.discount > 0 ? formatMoney(item.discount, false) : '—'}</td>
                      <td className="text-right num strong">{formatMoney(item.lineTotal, false)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ alignItems: 'flex-start', gap: 18 }}>
              <div className="grow">
                {sale.returns.length > 0 && (
                  <div className="stack-sm">
                    <div className="form-section-title">Returns</div>
                    {sale.returns.map((r) => (
                      <div key={r.id} className="small">
                        <span className="mono strong">{r.returnNo}</span> · {formatDateTime(r.createdAt)} ·{' '}
                        {formatMoney(r.refundAmount)} ({r.refundMethod}) · {r.reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="stack-sm" style={{ width: 280 }}>
                <div className="total-row">
                  <span>Subtotal</span>
                  <span className="num">{formatMoney(sale.subtotal)}</span>
                </div>
                {sale.itemDiscountTotal > 0 && (
                  <div className="total-row">
                    <span>Item discounts</span>
                    <span className="num">- {formatMoney(sale.itemDiscountTotal)}</span>
                  </div>
                )}
                {sale.billDiscount > 0 && (
                  <div className="total-row">
                    <span>Bill discount</span>
                    <span className="num">- {formatMoney(sale.billDiscount)}</span>
                  </div>
                )}
                <div className="grand-total">
                  <span>Total</span>
                  <span className="num" style={{ fontSize: 22 }}>
                    {formatMoney(sale.totalAmount)}
                  </span>
                </div>
                {sale.paymentMethod === 'CASH' && (
                  <div className="total-row small">
                    <span>Cash {formatMoney(sale.amountTendered)}</span>
                    <span>Change {formatMoney(sale.changeAmount)}</span>
                  </div>
                )}
                {isAdmin && (
                  <div className="total-row text-success small">
                    <span>Gross profit</span>
                    <span className="num">{formatMoney(sale.grossProfit)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {returning && sale && (
        <ReturnModal
          sale={sale}
          onClose={() => setReturning(false)}
          onCompleted={() => {
            setReturning(false);
            reload();
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
