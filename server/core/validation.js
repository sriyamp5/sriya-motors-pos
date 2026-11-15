import { toFieldErrors } from '../../shared/schemas/index.js';
import { validationError, badRequest } from './errors.js';

/** Parses input with a Zod schema, throwing a 422 with per-field messages on failure. */
export function parse(schema, input) {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const fields = toFieldErrors(result.error);
    const first = Object.values(fields)[0];
    throw validationError(fields, first ?? 'Please correct the highlighted fields');
  }
  return result.data;
}

/** Parses a positive integer route parameter. */
export function parseId(value, label = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${label}`);
  return id;
}
