import { z } from 'zod';
import {
  ROLES,
  PAYMENT_METHODS,
  REFUND_METHODS,
  PART_TYPES,
  UNITS,
  VEHICLE_TYPES,
  PASSWORD_MIN_LENGTH,
} from '../constants.js';
import {
  requiredText,
  optionalText,
  requiredInteger,
  optionalInteger,
  requiredId,
  optionalId,
  money,
  phoneNumber,
  optionalEmail,
  booleanFlag,
  isoDate,
} from './common.js';

export * from './common.js';

/* ---------------------------------------------------------------- Auth --- */

const password = (label = 'Password') =>
  z
    .string({ error: `${label} is required` })
    .min(PASSWORD_MIN_LENGTH, `${label} must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(72, `${label} must be at most 72 characters`);

const username = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z
    .string({ error: 'Username is required' })
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9._-]+$/, 'Username can contain only letters, numbers, dot, dash and underscore'),
);

export const loginSchema = z.object({
  username,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: password('New password'),
    confirmPassword: z.string({ error: 'Please confirm the new password' }),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });

/* --------------------------------------------------------------- Users --- */

const role = z.enum(Object.values(ROLES), { error: 'Select a valid role' });

export const createUserSchema = z
  .object({
    fullName: requiredText('Full name', 100),
    username,
    role,
    password: password(),
    confirmPassword: z.string({ error: 'Please confirm the password' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const updateUserSchema = z.object({
  fullName: requiredText('Full name', 100),
  role,
  isActive: booleanFlag,
});

export const resetPasswordSchema = z
  .object({
    newPassword: password('New password'),
    confirmPassword: z.string({ error: 'Please confirm the password' }),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/* --------------------------------------------------------- Master data --- */

export const categorySchema = z.object({
  name: requiredText('Category name', 100),
  description: optionalText('Description', 255),
});

export const brandSchema = z.object({
  name: requiredText('Brand name', 100),
  country: optionalText('Country', 60),
});

export const vehicleMakeSchema = z.object({
  name: requiredText('Make name', 60),
});

export const vehicleModelSchema = z.object({
  makeId: requiredId('Vehicle make'),
  name: requiredText('Model name', 80),
  vehicleType: z.enum(Object.values(VEHICLE_TYPES), { error: 'Select a vehicle type' }),
});

export const supplierSchema = z.object({
  name: requiredText('Supplier name', 150),
  contactPerson: optionalText('Contact person', 100),
  phone: phoneNumber('Phone'),
  email: optionalEmail(),
  address: optionalText('Address', 255),
  notes: optionalText('Notes', 500),
});

export const customerSchema = z.object({
  name: requiredText('Customer name', 150),
  phone: phoneNumber('Phone'),
  address: optionalText('Address', 255),
  vehicleNo: optionalText('Vehicle number', 20),
  notes: optionalText('Notes', 500),
});

/* ------------------------------------------------------------ Products --- */

const fitmentSchema = z
  .object({
    vehicleModelId: requiredId('Vehicle model'),
    yearFrom: optionalInteger('Year from', { min: 1950, max: 2100 }),
    yearTo: optionalInteger('Year to', { min: 1950, max: 2100 }),
  })
  .refine((f) => f.yearFrom === null || f.yearTo === null || f.yearTo >= f.yearFrom, {
    path: ['yearTo'],
    message: 'Year to must be the same or after year from',
  });

const productFields = {
  name: requiredText('Item name', 150),
  partNumber: optionalText('Part number', 60),
  barcode: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null)),
    z
      .string()
      .max(64, 'Barcode must be at most 64 characters')
      .regex(/^[\x21-\x7E]+$/, 'Barcode contains invalid characters')
      .nullable(),
  ),
  categoryId: requiredId('Category'),
  brandId: optionalId('Brand'),
  partType: z.enum(Object.values(PART_TYPES), { error: 'Select a part type' }),
  unit: z.enum(Object.values(UNITS), { error: 'Select a unit' }),
  costPrice: money('Buying price'),
  sellingPrice: money('Selling price', { min: 0.01 }),
  reorderLevel: requiredInteger('Low stock level', { min: 0, max: 100000 }),
  rackLocation: optionalText('Rack location', 50),
  warrantyMonths: optionalInteger('Warranty', { min: 0, max: 120 }),
  description: optionalText('Description', 1000),
  fitments: z.array(fitmentSchema).max(50, 'Too many vehicle fitments').default([]),
};

export const createProductSchema = z.object({
  ...productFields,
  openingStock: requiredInteger('Opening stock', { min: 0, max: 1_000_000 }),
});

export const updateProductSchema = z.object({
  ...productFields,
  isActive: booleanFlag.default(true),
});

export const stockAdjustmentSchema = z.object({
  productId: requiredId('Item'),
  quantityChange: requiredInteger('Quantity change', { min: -1_000_000, max: 1_000_000 }).refine(
    (v) => v !== 0,
    'Quantity change cannot be zero',
  ),
  reason: requiredText('Reason', 60),
  note: optionalText('Note', 255),
});

/* ----------------------------------------------------------- Purchases --- */

export const createPurchaseSchema = z.object({
  supplierId: requiredId('Supplier'),
  supplierInvoiceNo: optionalText('Supplier invoice number', 60),
  purchaseDate: isoDate('Received date'),
  notes: optionalText('Notes', 500),
  items: z
    .array(
      z.object({
        productId: requiredId('Item'),
        quantity: requiredInteger('Quantity', { min: 1, max: 1_000_000 }),
        unitCost: money('Buying price'),
        sellingPrice: z.preprocess(
          (v) => (v === '' || v === undefined ? null : v === null ? null : Number(v)),
          z.number().min(0.01, 'Selling price must be greater than 0').nullable(),
        ),
      }),
    )
    .min(1, 'Add at least one item'),
});

/* --------------------------------------------------------------- Sales --- */

export const saleItemSchema = z.object({
  productId: requiredId('Item'),
  quantity: requiredInteger('Quantity', { min: 1, max: 100_000 }),
  unitPrice: money('Price', { min: 0 }),
  discount: money('Discount').default(0),
});

export const createSaleSchema = z
  .object({
    items: z.array(saleItemSchema).min(1, 'The bill has no items'),
    billDiscount: money('Bill discount').default(0),
    paymentMethod: z.enum(Object.values(PAYMENT_METHODS), { error: 'Select a payment method' }),
    amountTendered: money('Amount received').default(0),
    cardReference: optionalText('Card reference', 40),
    customerId: optionalId('Customer'),
    customerName: optionalText('Customer name', 150),
    customerPhone: phoneNumber('Customer phone'),
    vehicleNo: optionalText('Vehicle number', 20),
    notes: optionalText('Notes', 255),
    // Set once per checkout by the till so a retried request cannot create a second sale.
    clientRef: z
      .string()
      .regex(/^[A-Za-z0-9-]{8,40}$/, 'Invalid checkout reference')
      .optional(),
  })
  .superRefine((sale, ctx) => {
    if (sale.paymentMethod === PAYMENT_METHODS.CREDIT && !sale.customerId) {
      if (!sale.customerName) {
        ctx.addIssue({ code: 'custom', path: ['customerName'], message: 'Customer name is required for credit sales' });
      }
      if (!sale.customerPhone) {
        ctx.addIssue({
          code: 'custom',
          path: ['customerPhone'],
          message: 'Customer phone is required for credit sales',
        });
      }
    }
  });

/* ------------------------------------------------------------- Returns --- */

export const createReturnSchema = z.object({
  saleId: requiredId('Invoice'),
  refundMethod: z.enum(Object.values(REFUND_METHODS), { error: 'Select a refund method' }),
  reason: requiredText('Reason', 255),
  items: z
    .array(
      z.object({
        saleItemId: requiredId('Invoice line'),
        quantity: requiredInteger('Return quantity', { min: 1, max: 100_000 }),
        restock: booleanFlag.default(true),
      }),
    )
    .min(1, 'Select at least one item to return'),
});

/* ------------------------------------------------- Customer settlement --- */

export const customerPaymentSchema = z.object({
  amount: money('Amount', { min: 0.01 }),
  method: z.enum([PAYMENT_METHODS.CASH, PAYMENT_METHODS.CARD], { error: 'Select a payment method' }),
  reference: optionalText('Reference', 60),
  note: optionalText('Note', 255),
});

/* ------------------------------------------------------- Cash closing --- */

export const cashClosingSchema = z.object({
  businessDate: isoDate('Date'),
  openingFloat: money('Opening cash'),
  countedCash: money('Counted cash'),
  notes: optionalText('Notes', 500),
});

/* ------------------------------------------------------------ Settings --- */

export const shopSettingsSchema = z.object({
  shopName: requiredText('Shop name', 100),
  shopAddress: optionalText('Address', 255),
  shopPhone: optionalText('Phone', 60),
  shopEmail: optionalEmail(),
  receiptFooter: optionalText('Receipt footer', 255),
  receiptPrinter: optionalText('Receipt printer', 150),
  silentPrint: booleanFlag,
  allowBelowCostSale: booleanFlag,
  backupDir: optionalText('Backup folder', 500),
  backupKeepCount: requiredInteger('Backups to keep', { min: 3, max: 365 }),
});

export const databaseConfigSchema = z.object({
  host: requiredText('Host', 100),
  port: requiredInteger('Port', { min: 1, max: 65535 }),
  user: requiredText('User', 60),
  password: z.string().max(200).default(''),
  database: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: 'Database name is required' })
      .regex(/^[A-Za-z0-9_]{1,64}$/, 'Database name can contain only letters, numbers and underscore'),
  ),
});
