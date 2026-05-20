/**
 * EventListener: Watches smart contract events and syncs to Redis.
 * Uses getLogs polling instead of eth_newFilter — Mezo testnet drops filters quickly.
 */

import { ethers } from 'ethers';
import crypto from 'crypto';

function normalizeGameState(state) {
  if (!state || !Array.isArray(state.players)) return null;
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      walletAddress: p.walletAddress ?? p.address ?? p.id ?? '',
      chips:         p.chips         ?? p.stack          ?? 0,
      bet:           p.bet           ?? p.betThisStreet   ?? 0,
      holeCards:     p.holeCards     ?? p.hand            ?? [],
    })),
  };
}
import { createRequire } from 'module';
import { mezoTestnet } from './mezo.config.js';

const require = createRequire(import.meta.url);
const POOL_ABI = require('./abis/Pool.json');

const POLL_INTERVAL_MS = 6000; // 6 s — roughly one Mezo block
const LOG_CHUNK = 200;         // blocks per getLogs call

export default class EventListener {
  constructor({ contractAddress, redisClient, historian, cancellationManager }) {
    this.contractAddress = contractAddress;
    this.redisClient = redisClient;
    this.historian = historian;
    this.cancellationManager = cancellationManager;
    this.provider = null;
    this.contract = null;
    this.iface = null;
    this.isRunning = false;
    this._pollTimer = null;
    this._lastBlock = null;
  }

  async start() {
    try {
      const rpcUrl = mezoTestnet.rpcUrls.default.http[0];
      this.provider = new ethers.JsonRpcProvider(rpcUrl, {
        chainId: mezoTestnet.id,
        name: mezoTestnet.network,
      }, { staticNetwork: true });

      this.contract = new ethers.Contract(this.contractAddress, POOL_ABI, this.provider);
      this.iface = new ethers.Interface(POOL_ABI);

      // Start from the current block — don't replay old events
      this._lastBlock = await this.provider.getBlockNumber();

      console.log('🔗 EventListener connected, polling from block', this._lastBlock);

      this.isRunning = true;
      this._schedulePoll();
      console.log('✓ EventListener watching contract events');
    } catch (error) {
      console.error('EventListener failed to start:', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    console.log('✓ EventListener stopped');
  }

  _schedulePoll() {
    if (!this.isRunning) return;
    this._pollTimer = setTimeout(async () => {
      try {
        await this._poll();
      } catch (err) {
        if (this._isConnectionError(err)) {
          console.warn('EventListener RPC connection lost, reconnecting...');
          await this._reconnect();
        } else {
          console.error('EventListener poll error:', err.message);
        }
      } finally {
        this._schedulePoll();
      }
    }, POLL_INTERVAL_MS);
  }

  _isConnectionError(err) {
    const msg = err.message || '';
    return (
      msg.includes('SSL') ||
      msg.includes('ssl') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('socket hang up') ||
      msg.includes('network error')
    );
  }

  async _reconnect() {
    try {
      const rpcUrl = mezoTestnet.rpcUrls.default.http[0];
      this.provider = new ethers.JsonRpcProvider(rpcUrl, {
        chainId: mezoTestnet.id,
        name: mezoTestnet.network,
      }, { staticNetwork: true });
      this.contract = new ethers.Contract(this.contractAddress, POOL_ABI, this.provider);
      console.log('✓ EventListener reconnected to RPC');
    } catch (err) {
      console.error('EventListener reconnect failed:', err.message);
    }
  }

  async _poll() {
    const latest = await this.provider.getBlockNumber();
    if (latest <= this._lastBlock) return;

    const fromBlock = this._lastBlock + 1;
    const toBlock = Math.min(latest, fromBlock + LOG_CHUNK - 1);

    const logs = await this.provider.getLogs({
      address: this.contractAddress,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      try {
        const parsed = this.iface.parseLog(log);
        if (!parsed) continue;
        const { name, args } = parsed;

        // Only handle known pool events — skip AdminUpdated and anything without a poolId
        const POOL_EVENTS = new Set(['PoolCreated', 'DepositMade', 'WithdrawalMade', 'PoolCancelled', 'awardedPot']);
        if (!POOL_EVENTS.has(name)) continue;

        // Validate poolId is a safe numeric string before using in Redis keys
        const poolId = BigInt(args[0]);
        if (poolId < 0n || poolId > 2n ** 128n) {
          console.error(`Skipping event ${name}: poolId out of range`);
          continue;
        }

        if (name === 'PoolCreated')        await this._onPoolCreated(poolId, args[1]);
        else if (name === 'DepositMade')   await this._onDepositMade(poolId, args[1], args[2]);
        else if (name === 'WithdrawalMade') await this._onWithdrawalMade(poolId, args[1], args[2]);
        else if (name === 'awardedPot')    await this._onRewardReleased(poolId, args[1], args[2]);
        else if (name === 'PoolCancelled') await this._onPoolCancelled(poolId);
      } catch (err) {
        console.error('Error parsing log:', err.message);
      }
    }

    this._lastBlock = toBlock;
  }

  async _onPoolCreated(poolId, creator) {
    try {
      console.log(`📍 PoolCreated: poolId=${poolId}, creator=${creator}`);

      const poolState = {
        poolId: poolId.toString(),
        creator,
        status: 'ACTIVE',
        createdAt: Date.now(),
        playerCount: 0,
        totalDeposited: '0',
        handNumber: 0,
      };

      await this.redisClient.hSet(`room:${poolId}:state`, 'data', JSON.stringify(poolState));
      // Don't pre-populate players — the creator's seat is confirmed by DepositMade event

      if (this.cancellationManager) {
        await this.cancellationManager.startPoolTimeout(poolId);
      }

      console.log(`✓ Pool ${poolId} initialized in Redis`);
    } catch (error) {
      console.error('Error handling PoolCreated:', error);
    }
  }

  async _onDepositMade(poolId, participant, amount) {
    try {
      const addr = participant.toLowerCase();
      console.log(`💰 DepositMade: poolId=${poolId}, player=${addr}, amount=${amount}`);

      // Convert wei to chips. 1 Mezo Token (1e18 wei) = CHIPS_PER_TOKEN chips.
      const CHIPS_PER_TOKEN = 100;
      const tokenAmount = Number(BigInt(amount.toString()) / BigInt(1e15)) / 1000; // tokens with 3dp precision
      const chips = Math.floor(tokenAmount * CHIPS_PER_TOKEN);

      // Bootstrap room state if PoolCreated event was missed (e.g. server restarted after pool creation)
      const existingState = await this.redisClient.hGet(`room:${poolId}:state`, 'data');
      if (!existingState) {
        const fallbackState = {
          poolId: poolId.toString(),
          creator: null, // unknown without PoolCreated event
          status: 'ACTIVE',
          createdAt: Date.now(),
          playerCount: 0,
          totalDeposited: '0',
          handNumber: 0,
        };
        await this.redisClient.hSet(`room:${poolId}:state`, 'data', JSON.stringify(fallbackState));
        console.log(`⚠ Bootstrapped room:${poolId}:state from DepositMade (PoolCreated was missed)`);
      }

      // Merge with any existing record (socket join may have already created a pending entry).
      const existing = await this.redisClient.hGet(`room:${poolId}:players`, addr);
      const base = (existing && existing !== 'joined') ? JSON.parse(existing) : {};

      await this.redisClient.hSet(`room:${poolId}:players`, addr, JSON.stringify({
        ...base,
        address: addr,
        stack: chips,
        depositAmount: amount.toString(), // raw wei — kept for audit
        joinedAt: base.joinedAt || Date.now(),
        status: 'active',
      }));

      // Count only on-chain confirmed (active) players — socket-joined entries don't count
      const allPlayers = await this.redisClient.hGetAll(`room:${poolId}:players`);
      const activeCount = Object.values(allPlayers).filter(raw => {
        try { return JSON.parse(raw).status === 'active'; } catch { return false; }
      }).length;

      console.log(`🎮 Pool ${poolId} has ${activeCount}/5 confirmed players (${addr} → ${chips} chips)`);

      this.io.to(`pool:${poolId}`).emit('PLAYER_JOINED', {
        walletAddress: addr,
        chips,
        playerCount: activeCount,
      });

      if (activeCount === 5) {
        await this._startGame(poolId);
      }
    } catch (error) {
      console.error('Error handling DepositMade:', error);
    }
  }

  async _onWithdrawalMade(poolId, participant, amount) {
    try {
      console.log(`🚪 WithdrawalMade: poolId=${poolId}, player=${participant}, amount=${amount}`);
      await this.redisClient.hDel(`room:${poolId}:players`, participant.toLowerCase());
      const remaining = await this.redisClient.hLen(`room:${poolId}:players`);
      console.log(`✓ Player ${participant} removed from pool ${poolId} (${remaining} remaining)`);
    } catch (error) {
      console.error('Error handling WithdrawalMade:', error);
    }
  }

  async _onRewardReleased(poolId, participant, amount) {
    try {
      console.log(`🏆 RewardReleased: poolId=${poolId}, amount=${amount}`);
      await this.redisClient.hSet(`reward:${poolId}:${participant}`, 'amount', amount.toString());
      console.log(`✓ Reward recorded for ${participant}`);
    } catch (error) {
      console.error('Error handling RewardReleased:', error);
    }
  }

  async _onPoolCancelled(poolId) {
    try {
      console.log(`❌ PoolCancelled: poolId=${poolId}`);

      if (this.io) {
        this.io.to(`pool:${poolId}`).emit('POOL_CANCELLED', { poolId: poolId.toString(), reason: 'on-chain' });
      }

      // Full cleanup — players are refunded on-chain, no need to keep Redis state
      await this.redisClient.del(`room:${poolId}:state`);
      await this.redisClient.del(`room:${poolId}:players`);
      await this.redisClient.del(`oracle:seed:${poolId}`);

      if (this.gameRoomManager) {
        this.gameRoomManager.activeGames.delete(poolId.toString());
      }

      if (this.cancellationManager) {
        this.cancellationManager.clearPoolTimeout(poolId);
      }

      console.log(`✓ Pool ${poolId} cleaned up`);
    } catch (error) {
      console.error('Error handling PoolCancelled:', error);
    }
  }

  async _startGame(poolId) {
    try {
      const poolKey = `room:${poolId}:state`;
      const poolDataStr = await this.redisClient.hGet(poolKey, 'data');
      if (poolDataStr) {
        const poolState = JSON.parse(poolDataStr);
        // Guard against double-start
        if (poolState.gameStarted) {
          console.log(`⚠ Pool ${poolId} already started — skipping duplicate _startGame`);
          return;
        }
        poolState.gameStarted = true;
        poolState.startedAt = Date.now();
        await this.redisClient.hSet(poolKey, 'data', JSON.stringify(poolState));
      }

      // Clear the fill timeout so it doesn't fire and try to cancel an active game
      if (this.cancellationManager) {
        this.cancellationManager.clearPoolTimeout(poolId);
      }

      console.log(`🚀 Starting game in pool ${poolId}`);

      // Generate and store the shuffle seed so createRoom can find it
      const seed = crypto.randomBytes(32).toString('hex');
      await this.redisClient.set(`oracle:seed:${poolId}`, seed, { EX: 86400 });

      // Build player list from Redis for game initialization
      const playersRaw = await this.redisClient.hGetAll(`room:${poolId}:players`);
      const players = Object.entries(playersRaw).map(([addr, raw]) => {
        try { const p = JSON.parse(raw); return { id: addr, address: addr, stack: p.stack ?? 1000 }; }
        catch { return { id: addr, address: addr, stack: 1000 }; }
      });

      // Initialize game room and get initial state
      let gameState = null;
      if (this.gameRoomManager) {
        try {
          gameState = await this.gameRoomManager.createRoom(poolId.toString(), players);
          console.log(`✓ Game room initialized for pool ${poolId}`);
        } catch (err) {
          console.warn(`⚠ gameRoomManager.createRoom failed for pool ${poolId}: ${err.message}`);
        }
      }

      // Emit to each client individually — strip opponents' hole cards per socket
      if (this.io) {
        const normalized = normalizeGameState(gameState);
        if (normalized) {
          const room = `pool:${poolId}`;
          const isShowdown = Array.isArray(normalized.winners) && normalized.winners.length > 0;
          const roomSockets = this.io.sockets.adapter.rooms.get(room);
          if (roomSockets) {
            for (const socketId of roomSockets) {
              const s = this.io.sockets.sockets.get(socketId);
              if (!s) continue;
              const addr = (s.data?.walletAddress ?? '').toLowerCase();
              s.emit('GAME_STATE_UPDATED', {
                ...normalized,
                players: normalized.players.map(p => ({
                  ...p,
                  holeCards: isShowdown || p.walletAddress.toLowerCase() === addr
                    ? p.holeCards
                    : [],
                })),
              });
            }
          }
        }
        // if createRoom failed, clients stay on waiting screen — no crash
      }

      console.log(`✓ Game started in pool ${poolId}`);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  }

  async syncPoolState(poolId) {
    try {
      const pool = await this.contract.pools(poolId);
      return {
        id: pool.id.toString(),
        creator: pool.creator,
        balance: pool.balance.toString(),
        status: pool.poolStatus === 0 ? 'ACTIVE' : 'CLOSED',
        participants: pool.participants.filter(addr => addr !== ethers.ZeroAddress),
      };
    } catch (error) {
      console.error('Error syncing pool state:', error);
      return null;
    }
  }

  async ping() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return { connected: true, blockNumber };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}
