/**
 * Global Express error boundary.
 *
 * Catches all errors from routes and Socket.io handlers.
 * Logs error details internally.
 * Returns standardized error response with status code and message.
 *
 * Usage:
 * app.use(errorHandler);
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Determine HTTP status code from error type/name.
 */
function getStatusCode(err) {
  if (err.status) return err.status;
  if (err.statusCode) return err.statusCode;

  const name = err.name || '';
  const message = (err.message || '').toLowerCase();

  if (name === 'ValidationError' || message.includes('invalid') || message.includes('required')) {
    return 400;
  }
  if (name === 'UnauthorizedError' || message.includes('unauthorized') || message.includes('token')) {
    return 401;
  }
  if (name === 'ForbiddenError' || message.includes('forbidden') || message.includes('not allowed')) {
    return 403;
  }
  if (name === 'NotFoundError' || message.includes('not found')) {
    return 404;
  }

  return 500;
}

export default function errorHandler(err, req, res, next) {
  const status = getStatusCode(err);

  // Always log the full error internally
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}`);
  console.error(err);

  // Build response
  const response = { error: '' };

  if (isProduction) {
    // Generic messages in production — never expose internals
    switch (status) {
      case 400: response.error = 'Bad request'; break;
      case 401: response.error = 'Authentication required'; break;
      case 403: response.error = 'Access denied'; break;
      case 404: response.error = 'Resource not found'; break;
      default:  response.error = 'Internal server error'; break;
    }
  } else {
    // Full details in development
    response.error = err.message || 'Internal server error';
    response.stack = err.stack;
  }

  res.status(status).json(response);
}


/**
 * Global Express error boundary.
 * Path: SRC\middleware\ErrorHandler.js
 */

import { logger } from '../config/logger.js';

/**
 * Standardized Error Response Middleware
 */
export default function errorHandler(err, req, res, next) {
  // 1. Log the error details with Pino
  // We log the stack trace and request info for debugging
  logger.error({
    msg: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });

  // 2. Classify the error
  // If the error has a status code (e.g. from a custom error or library), use it.
  // Otherwise, default to 500 (Internal Server Error).
  const statusCode = err.status || err.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  // 3. Determine the message to show the user
  // In production, we don't want to show raw 500 error messages to avoid leaking logic.
  let message = err.message;
  if (!isClientError && process.env.NODE_ENV === 'production') {
    message = 'An unexpected server error occurred. Please try again later.';
  }

  // 4. Send standardized error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || 'INTERNAL_ERROR',
      // Only include stack trace if NOT in production
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
  });
}