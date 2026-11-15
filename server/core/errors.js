/**
 * Application error carrying an HTTP status, a stable machine readable code
 * and a message that is safe to show to the user.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const validationError = (fields, message = 'Please correct the highlighted fields') =>
  new AppError(422, 'VALIDATION_ERROR', message, { fields });
export const unauthorized = (message = 'Please sign in to continue') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to do this') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (entity = 'Record') => new AppError(404, 'NOT_FOUND', `${entity} not found`);
export const conflict = (message, details) => new AppError(409, 'CONFLICT', message, details);
export const serviceUnavailable = (message, code = 'SERVICE_UNAVAILABLE') => new AppError(503, code, message);
