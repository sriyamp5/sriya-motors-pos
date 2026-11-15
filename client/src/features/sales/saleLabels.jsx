import { PAYMENT_METHOD_LABELS, REFUND_METHODS, SALE_STATUS_LABELS } from '@shared/constants.js';
import { Badge } from '@/components/ui/index.js';

const STATUS_TONES = { COMPLETED: 'success', PARTIALLY_RETURNED: 'warning', RETURNED: 'danger' };
const METHOD_TONES = { CASH: 'default', CARD: 'info', CREDIT: 'accent' };

export const SaleStatusBadge = ({ status }) => <Badge tone={STATUS_TONES[status]}>{SALE_STATUS_LABELS[status]}</Badge>;

export const PaymentBadge = ({ method }) => <Badge tone={METHOD_TONES[method]}>{PAYMENT_METHOD_LABELS[method]}</Badge>;

/** Refund channels that make sense for how the sale was paid. */
export const refundOptionsFor = (sale) =>
  sale.paymentMethod === 'CREDIT'
    ? [REFUND_METHODS.CREDIT, REFUND_METHODS.CASH]
    : sale.paymentMethod === 'CARD'
      ? [REFUND_METHODS.CARD, REFUND_METHODS.CASH]
      : [REFUND_METHODS.CASH];

export const refundLabel = (method) =>
  method === REFUND_METHODS.CREDIT ? 'Reduce credit balance' : `${PAYMENT_METHOD_LABELS[method]} refund`;
