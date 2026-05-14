/**
 * Global Express error boundary.
 *
 * Should catch all errors from routes and Socket.io handlers.
 * Log error details using pino logger.
 * Return standardized error response with status code and message.
 *
 * Usage:
 * app.use(errorHandler);
 */

export default function errorHandler(err, req, res, next) {
  // TODO: Implement error logging with logger
  // TODO: Implement error classification (4xx vs 5xx)
  // TODO: Implement standardized error response format
  // TODO: Handle sensitive error details in production
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