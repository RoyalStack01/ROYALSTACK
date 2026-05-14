/**
 * WalletConnect authentication module.
 * Users sign a message to prove wallet ownership.
 * No profiles — wallet address is the identity.
 */

import crypto from 'crypto';
import { ethers } from 'ethers';

export class WalletAuthService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.MESSAGE_TEMPLATE = 'ROYALSTACK Login: ';
    this.NONCE_TTL = 300; // 5 minutes
    this.SESSION_TTL = 86400 * 7; // 7 days
  }

  /**
   * Generate a nonce for wallet signature challenge
   * @param {string} walletAddress - User's wallet address
   * @returns {Promise<string>} Nonce to sign
   */
  async generateNonce(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `${this.MESSAGE_TEMPLATE}${nonce}`;

    // Store nonce in Redis (expires in 5 min)
    await this.redis.setEx(
      `auth:nonce:${normalizedAddress}`,
      this.NONCE_TTL,
      nonce
    );

    return {
      nonce,
      message, // Frontend signs this exact message
      expiresIn: this.NONCE_TTL,
    };
  }

  /**
   * Verify signed message and create session
   * @param {string} walletAddress - User's wallet address
   * @param {string} signature - Signed message from wallet
   * @param {string} message - The exact message that was signed
   * @returns {Promise<{valid, sessionToken?, error?}>}
   */
  async verifySignature(walletAddress, signature, message) {
    try {
      const normalizedAddress = walletAddress.toLowerCase();

      // 1. Extract nonce from message
      if (!message.startsWith(this.MESSAGE_TEMPLATE)) {
        return { valid: false, error: 'Invalid message format' };
      }

      const nonce = message.slice(this.MESSAGE_TEMPLATE.length);

      // 2. Check nonce exists and hasn't expired
      const storedNonce = await this.redis.get(
        `auth:nonce:${normalizedAddress}`
      );
      if (!storedNonce || storedNonce !== nonce) {
        return { valid: false, error: 'Invalid or expired nonce' };
      }

      // 3. Verify signature using ethers.verifyMessage()
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        return { valid: false, error: 'Signature verification failed' };
      }

      // 4. Create session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      await this.redis.setEx(
        `session:${sessionToken}`,
        this.SESSION_TTL,
        normalizedAddress
      );

      // 5. Clean up nonce
      await this.redis.del(`auth:nonce:${normalizedAddress}`);

      return {
        valid: true,
        sessionToken,
        walletAddress: normalizedAddress,
        expiresIn: this.SESSION_TTL,
      };
    } catch (error) {
      return { valid: false, error: 'Authentication failed' };
    }
  }

  /**
   * Verify session token
   * @param {string} sessionToken - Session token from client
   * @returns {Promise<{valid, walletAddress?}>}
   */
  async verifySession(sessionToken) {
    try {
      const walletAddress = await this.redis.get(`session:${sessionToken}`);
      if (!walletAddress) {
        return { valid: false };
      }

      // Refresh session TTL on each verification
      await this.redis.expire(`session:${sessionToken}`, this.SESSION_TTL);

      return { valid: true, walletAddress };
    } catch (error) {
      return { valid: false };
    }
  }

  /**
   * Logout: invalidate session
   * @param {string} sessionToken
   * @returns {Promise<void>}
   */
  async logout(sessionToken) {
    await this.redis.del(`session:${sessionToken}`);
  }

  /**
   * Get all active sessions for a wallet (for multi-device detection)
   * @param {string} walletAddress
   * @returns {Promise<Array>} Array of session tokens
   */
  async getActiveSessions(walletAddress) {
    const normalizedAddress = walletAddress.toLowerCase();
    const sessions = [];
    let cursor = 0;

    do {
      const reply = await this.redis.scan(cursor, { MATCH: 'session:*', COUNT: 100 });
      cursor = reply.cursor;
      for (const key of reply.keys) {
        const addr = await this.redis.get(key);
        if (addr && addr.toLowerCase() === normalizedAddress) {
          sessions.push(key);
        }
      }
    } while (cursor !== 0);

    return sessions;
  }
}
