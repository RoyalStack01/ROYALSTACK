/**
 * Redis read/write for player state: room:{poolId}:players
 * Path: SRC\rooms\PlayerState.js
 */

import { redisClient } from '../config/redis.js';
import crypto from 'crypto';

// Ensure your environment variable is a 32-byte string for aes-256-cbc
const ENCRYPTION_KEY = process.env.HOLE_CARD_SECRET || 'your-32-character-secret-key-012'; 
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Internal utility to encrypt sensitive player data
 */
const encryptCards = (data) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

/**
 * Internal utility to decrypt sensitive player data
 */
const decryptCards = (encryptedText) => {
  const [ivHex, encryptedHex] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return JSON.parse(decrypted.toString());
};

const playerState = {
  /**
   * Save player state
   * Encrypts holeCards if present in the playerData object
   */
  async save(poolId, playerId, playerData) {
    const key = `room:${poolId}:players`;
    const dataToSave = { ...playerData };

    if (dataToSave.holeCards) {
      dataToSave.holeCards = encryptCards(dataToSave.holeCards);
    }

    await redisClient.hSet(key, playerId, JSON.stringify(dataToSave));
  },

  /**
   * Retrieve player data
   * Decrypts holeCards before returning the object
   */
  async load(poolId, playerId) {
    const key = `room:${poolId}:players`;
    const rawData = await redisClient.hGet(key, playerId);
    
    if (!rawData) return null;
    const data = JSON.parse(rawData);

    if (data.holeCards && typeof data.holeCards === 'string') {
      data.holeCards = decryptCards(data.holeCards);
    }
    return data;
  },

  /**
   * Get all players in a specific room
   */
  async loadAll(poolId) {
    const key = `room:${poolId}:players`;
    const allPlayersRaw = await redisClient.hGetAll(key);
    
    const players = [];
    for (const [id, rawData] of Object.entries(allPlayersRaw)) {
      const data = JSON.parse(rawData);
      if (data.holeCards && typeof data.holeCards === 'string') {
        data.holeCards = decryptCards(data.holeCards);
      }
      players.push({ playerId: id, ...data });
    }
    return players;
  },

  /**
   * Merge changes into existing player state
   */
  async update(poolId, playerId, delta) {
    const currentData = await this.load(poolId, playerId) || {};
    const updatedData = { ...currentData, ...delta };
    await this.save(poolId, playerId, updatedData);
    return updatedData;
  },

  /**
   * Delete player record from the room hash
   */
  async remove(poolId, playerId) {
    const key = `room:${poolId}:players`;
    await redisClient.hDel(key, playerId);
  }
};

export default playerState;