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
