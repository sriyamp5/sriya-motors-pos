/**
 * Domain constants shared by the server and the client.
 * Keeping them in one place guarantees that validation, database enums
 * and UI dropdowns always agree.
 */

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
});

export const ROLE_LABELS = Object.freeze({
  ADMIN: 'Admin',
  CASHIER: 'Cashier',
});

export const PAYMENT_METHODS = Object.freeze({
  CASH: 'CASH',
  CARD: 'CARD',
  CREDIT: 'CREDIT',
});

export const PAYMENT_METHOD_LABELS = Object.freeze({
  CASH: 'Cash',
  CARD: 'Card',
  CREDIT: 'Credit',
});

/** Refund channels. CREDIT reduces the customer's outstanding balance. */
export const REFUND_METHODS = Object.freeze({
  CASH: 'CASH',
  CARD: 'CARD',
  CREDIT: 'CREDIT',
});

export const SALE_STATUSES = Object.freeze({
  COMPLETED: 'COMPLETED',
  PARTIALLY_RETURNED: 'PARTIALLY_RETURNED',
  RETURNED: 'RETURNED',
});

export const SALE_STATUS_LABELS = Object.freeze({
  COMPLETED: 'Completed',
  PARTIALLY_RETURNED: 'Partially returned',
  RETURNED: 'Returned',
});

/** Origin / condition of a spare part, as commonly used in Sri Lankan parts shops. */
export const PART_TYPES = Object.freeze({
  GENUINE: 'GENUINE',
  OEM: 'OEM',
  AFTERMARKET: 'AFTERMARKET',
  RECONDITIONED: 'RECONDITIONED',
  USED: 'USED',
});

export const PART_TYPE_LABELS = Object.freeze({
  GENUINE: 'Genuine',
  OEM: 'OEM',
  AFTERMARKET: 'Aftermarket',
  RECONDITIONED: 'Reconditioned',
  USED: 'Used',
});

export const UNITS = Object.freeze({
  PCS: 'PCS',
  SET: 'SET',
  PAIR: 'PAIR',
  KIT: 'KIT',
  LITRE: 'LITRE',
  BOTTLE: 'BOTTLE',
  METRE: 'METRE',
  BOX: 'BOX',
});

export const UNIT_LABELS = Object.freeze({
  PCS: 'Pieces',
  SET: 'Set',
  PAIR: 'Pair',
  KIT: 'Kit',
  LITRE: 'Litre',
  BOTTLE: 'Bottle',
  METRE: 'Metre',
  BOX: 'Box',
});

export const VEHICLE_TYPES = Object.freeze({
  CAR: 'CAR',
  VAN: 'VAN',
  SUV: 'SUV',
  CAB: 'CAB',
  LORRY: 'LORRY',
  BUS: 'BUS',
  THREE_WHEELER: 'THREE_WHEELER',
  MOTORCYCLE: 'MOTORCYCLE',
  TRACTOR: 'TRACTOR',
  OTHER: 'OTHER',
});

export const VEHICLE_TYPE_LABELS = Object.freeze({
  CAR: 'Car',
  VAN: 'Van',
  SUV: 'SUV / Jeep',
  CAB: 'Double / Single cab',
  LORRY: 'Lorry / Truck',
  BUS: 'Bus',
  THREE_WHEELER: 'Three-wheeler',
  MOTORCYCLE: 'Motorcycle',
  TRACTOR: 'Tractor',
  OTHER: 'Other',
});

export const STOCK_MOVEMENT_TYPES = Object.freeze({
  OPENING: 'OPENING',
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
});

export const STOCK_MOVEMENT_LABELS = Object.freeze({
  OPENING: 'Opening stock',
  PURCHASE: 'Goods received',
  SALE: 'Sale',
  RETURN: 'Customer return',
  ADJUSTMENT: 'Adjustment',
});

/** Reasons offered when an admin corrects stock manually. */
export const ADJUSTMENT_REASONS = Object.freeze([
  'Stock count correction',
  'Damaged',
  'Lost / missing',
  'Expired',
  'Returned to supplier',
  'Other',
]);

export const PASSWORD_MIN_LENGTH = 6;
