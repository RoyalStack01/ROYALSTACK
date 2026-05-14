/**
 * Authentication middleware for Express and WebSocket
 */

export function authMiddleware(authService) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer token

    if (!token) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }

    const { valid, walletAddress, error } = await authService.verifySession(
      token
    );

    if (!valid) {
      return res.status(401).json({ error: error || 'Invalid session' });
    }

    req.user = { walletAddress };
    next();
  };
}

export function wsAuthMiddleware(authService) {
  return async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Missing authentication token'));
    }

    const { valid, walletAddress, error } = await authService.verifySession(
      token
    );

    if (!valid) {
      return next(new Error(error || 'Invalid session'));
    }

    socket.user = { walletAddress };
    next();
  };
}
