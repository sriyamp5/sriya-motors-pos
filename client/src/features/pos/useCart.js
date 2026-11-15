import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { calculateBillTotals, lineNetTotal, toCents } from '@shared/money.js';

/**
 * Bill being prepared at the till. It is saved in local storage after every
 * change so a refresh, a crash or a power cut does not lose a half-scanned bill.
 */

const STORAGE_KEY = 'sm-pos-cart';

const EMPTY_CART = { lines: [], billDiscount: '', customer: { name: '', phone: '', vehicleNo: '', id: null } };

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.lines)) return { ...EMPTY_CART, ...saved };
  } catch {
    // Ignore unreadable saved carts.
  }
  return EMPTY_CART;
}

const lineFromProduct = (product) => ({
  key: `${product.id}-${Date.now()}`,
  productId: product.id,
  name: product.name,
  partNumber: product.partNumber,
  itemCode: product.itemCode,
  brandName: product.brandName,
  unit: product.unit,
  rackLocation: product.rackLocation,
  stockQty: product.stockQty,
  listPrice: product.sellingPrice,
  // Present only for admins; cashiers never receive buying prices.
  unitCost: product.costPrice,
  unitPrice: String(product.sellingPrice),
  quantity: 1,
  discount: '',
});

function reducer(state, action) {
  switch (action.type) {
    case 'add': {
      const { product } = action;
      const existing = state.lines.find(
        (l) => l.productId === product.id && toCents(l.unitPrice) === toCents(product.sellingPrice),
      );
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.key === existing.key ? { ...l, quantity: l.quantity + 1, stockQty: product.stockQty } : l,
          ),
        };
      }
      return { ...state, lines: [...state.lines, lineFromProduct(product)] };
    }
    case 'update':
      return {
        ...state,
        lines: state.lines.map((l) => (l.key === action.key ? { ...l, ...action.patch } : l)),
      };
    case 'remove':
      return { ...state, lines: state.lines.filter((l) => l.key !== action.key) };
    case 'setBillDiscount':
      return { ...state, billDiscount: action.value };
    case 'setCustomer':
      return { ...state, customer: { ...state.customer, ...action.patch } };
    case 'clear':
      return EMPTY_CART;
    default:
      return state;
  }
}

export function useCart() {
  const [cart, dispatch] = useReducer(reducer, undefined, loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage full or unavailable; the cart still works in memory.
    }
  }, [cart]);

  const totals = useMemo(
    () =>
      calculateBillTotals(
        cart.lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount })),
        cart.billDiscount,
      ),
    [cart.lines, cart.billDiscount],
  );

  const itemCount = useMemo(() => cart.lines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0), [cart.lines]);

  /** Client-side checks before checkout; the server validates again. */
  const problems = useMemo(() => {
    const list = [];
    for (const line of cart.lines) {
      const price = Number(line.unitPrice);
      if (line.unitPrice === '' || !Number.isFinite(price) || price < 0)
        list.push(`Enter a valid price for "${line.name}".`);
      if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1)
        list.push(`Enter a valid quantity for "${line.name}".`);
      if (Number(line.quantity) > line.stockQty) list.push(`Only ${line.stockQty} of "${line.name}" in stock.`);
      if (lineNetTotal(line.quantity, line.unitPrice, line.discount) < 0)
        list.push(`Discount for "${line.name}" is too large.`);
    }
    if (totals.total < 0) list.push('The bill discount is larger than the bill.');
    return list;
  }, [cart.lines, totals.total]);

  return {
    cart,
    totals,
    itemCount,
    problems,
    addProduct: useCallback((product) => dispatch({ type: 'add', product }), []),
    updateLine: useCallback((key, patch) => dispatch({ type: 'update', key, patch }), []),
    removeLine: useCallback((key) => dispatch({ type: 'remove', key }), []),
    setBillDiscount: useCallback((value) => dispatch({ type: 'setBillDiscount', value }), []),
    setCustomer: useCallback((patch) => dispatch({ type: 'setCustomer', patch }), []),
    clear: useCallback(() => dispatch({ type: 'clear' }), []),
  };
}
