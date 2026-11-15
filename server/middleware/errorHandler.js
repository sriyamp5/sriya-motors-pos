import { AppError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { isConnectionError } from '../db/database.js';

/** Translates MySQL errors into messages a shop user can act on. */
function fromDatabaseError(error) {
  switch (error.code) {
    case 'ER_DUP_ENTRY': {
      const key = /for key '(?:\w+\.)?(\w+)'/.exec(error.sqlMessage ?? '')?.[1] ?? '';
      const label = DUPLICATE_LABELS[key] ?? 'value';
      return new AppError(409, 'DUPLICATE', `This ${label} is already in use.`, { key });
    }
    case 'ER_ROW_IS_REFERENCED_2':
      return new AppError(409, 'IN_USE', 'This record is in use and cannot be deleted. Deactivate it instead.');
    case 'ER_NO_REFERENCED_ROW_2':
      return new AppError(422, 'INVALID_REFERENCE', 'A selected value no longer exists. Please refresh and try again.');
    case 'ER_LOCK_WAIT_TIMEOUT':
    case 'ER_LOCK_DEADLOCK':
      return new AppError(503, 'BUSY', 'The system is busy. Please try again.');
    default:
      if (isConnectionError(error)) {
        return new AppError(503, 'DB_UNAVAILABLE', 'Lost connection to the database. Please try again in a moment.');
      }
      return null;
  }
}

const DUPLICATE_LABELS = {
  uq_users_username: 'username',
  uq_products_barcode: 'barcode',
  uq_products_item_code: 'item code',
  uq_categories_name: 'category name',
  uq_brands_name: 'brand name',
  uq_vehicle_makes_name: 'vehicle make',
  uq_vehicle_models_make_name: 'model name for this make',
  uq_suppliers_name: 'supplier name',
  uq_customers_phone: 'phone number',
  uq_cash_closings_date: 'date (the day is already closed)',
};

// Express identifies error handlers by their four-argument signature.
export function errorHandler(error, req, res, _next) {
  let appError = error instanceof AppError ? error : fromDatabaseError(error);

  if (!appError && error?.type === 'entity.parse.failed') {
    appError = new AppError(400, 'BAD_JSON', 'The request could not be read.');
  }
  if (!appError && error?.type === 'entity.too.large') {
    appError = new AppError(413, 'TOO_LARGE', 'The request is too large.');
  }

  if (!appError) {
    logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, error);
    appError = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  } else if (appError.status >= 500) {
    logger.warn(`${appError.code} on ${req.method} ${req.originalUrl}: ${error.message}`);
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details ? { details: appError.details } : {}),
    },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}
