import { verifyMessage } from 'viem/utils';
import env from '../config/env.js';

/**
 * Socket.io auth middleware.
 * Verifies the player's wallet signature before allowing connection.
 *
 * Expected auth object:
 * {
 *   address: '0x...',
 *   message: 'Sign this to authenticate',
 *   signature: '0x...'
 * }
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const { address, message, signature } = socket.handshake.auth;

    if (!address || !message || !signature) {
      return next(new Error('Missing auth fields: address, message, signature'));
    }

    // Verify the signature
    const recoveredAddress = await verifyMessage({
      address,
      message,
      signature,
    });

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return next(new Error('Invalid signature'));
    }

    // Attach user to socket
    socket.user = {
      address: address.toLowerCase(),
      connectedAt: new Date(),
    };

    next();
  } catch (err) {
    next(new Error(`Auth failed: ${err.message}`));
  }
}

export { socketAuthMiddleware };
