import { z } from 'zod';

/**
 * Reusable field builders. Form inputs arrive as strings, so empty strings
 * are normalised to undefined/null before validation.
 */

const emptyToUndefined = (value) => (value === '' || value === null || value === undefined ? undefined : value);

const emptyToNull = (value) => (value === '' || value === undefined || value === null ? null : value);

const trimIfString = (value) => (typeof value === 'string' ? value.trim() : value);

/** Required text with a friendly label used in messages. */
export const requiredText = (label, max = 150) =>
  z.preprocess(
    trimIfString,
    z
      .string({ error: `${label} is required` })
      .min(1, `${label} is required`)
      .max(max, `${label} must be at most ${max} characters`),
  );

/** Optional text; blank values are stored as NULL. */
export const optionalText = (label, max = 255) =>
  z.preprocess(
    (v) => emptyToNull(trimIfString(v)),
    z.string().max(max, `${label} must be at most ${max} characters`).nullable(),
  );

/** Required number parsed from form input. */
export const requiredNumber = (label, { min = 0, max = 99_999_999 } = {}) =>
  z.preprocess(
    (v) => {
      const cleaned = emptyToUndefined(trimIfString(v));
      return cleaned === undefined ? undefined : Number(cleaned);
    },
    z
      .number({
        error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a valid number`),
      })
      .refine(Number.isFinite, `${label} must be a valid number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} is too large`),
  );

/** Required whole number. */
export const requiredInteger = (label, options) =>
  requiredNumber(label, options).refine(Number.isInteger, `${label} must be a whole number`);

/** Optional number; blank values become NULL. */
export const optionalNumber = (label, { min = 0, max = 99_999_999 } = {}) =>
  z.preprocess(
    (v) => {
      const cleaned = emptyToNull(trimIfString(v));
      return cleaned === null ? null : Number(cleaned);
    },
    z
      .number({ error: `${label} must be a valid number` })
      .refine(Number.isFinite, `${label} must be a valid number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} is too large`)
      .nullable(),
  );

/** Optional whole number; blank values become NULL. */
export const optionalInteger = (label, options) =>
  optionalNumber(label, options).refine((v) => v === null || Number.isInteger(v), `${label} must be a whole number`);

/** Required foreign key id. */
export const requiredId = (label) => requiredInteger(label, { min: 1, max: 2_147_483_647 });

/** Optional foreign key id; blank values become NULL. */
export const optionalId = (label) => optionalInteger(label, { min: 1, max: 2_147_483_647 });

/** Money amount in rupees with at most two decimals. */
export const money = (label, options) =>
  requiredNumber(label, options).refine(
    (v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6,
    `${label} can have at most 2 decimal places`,
  );

/**
 * Sri Lankan phone number. Accepts 0XXXXXXXXX or +94XXXXXXXXX,
 * spaces and dashes are ignored.
 */
export const phoneNumber = (label = 'Phone number', required = false) =>
  z.preprocess(
    (v) => {
      const cleaned = typeof v === 'string' ? v.replace(/[\s-]/g, '') : v;
      return emptyToNull(cleaned);
    },
    required
      ? z.string({ error: `${label} is required` }).regex(/^(\+94|0)\d{9}$/, `${label} must be like 0771234567`)
      : z
          .string()
          .regex(/^(\+94|0)\d{9}$/, `${label} must be like 0771234567`)
          .nullable(),
  );

export const optionalEmail = (label = 'Email') =>
  z.preprocess(
    (v) => emptyToNull(trimIfString(v)),
    z.email(`${label} is not a valid email address`).max(150).nullable(),
  );

export const booleanFlag = z.preprocess(
  (v) => (v === 'true' || v === '1' || v === 1 ? true : v === 'false' || v === '0' || v === 0 ? false : v),
  z.boolean(),
);

/** ISO date string (YYYY-MM-DD). */
export const isoDate = (label) =>
  z.preprocess(
    trimIfString,
    z.string({ error: `${label} is required` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a valid date`),
  );

/** Standard list query parameters. */
export const listQuerySchema = z.object({
  search: z.preprocess((v) => emptyToUndefined(trimIfString(v)), z.string().max(100).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  includeInactive: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
});

/**
 * Converts a Zod error into a flat { field: message } object suitable for
 * showing messages next to form inputs.
 */
export function toFieldErrors(error) {
  const fieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
