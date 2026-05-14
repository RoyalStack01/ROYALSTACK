/**
 * EventListener: Watches smart contract events and syncs to Redis.
 * Uses getLogs polling instead of eth_newFilter — Mezo testnet drops filters quickly.
 */

import { ethers } from 'ethers';
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

        // Validate poolId is a safe numeric string before using in Redis keys
        const poolId = BigInt(args[0]);
        if (poolId < 0n || poolId > 2n ** 128n) {
          console.error(`Skipping event ${name}: poolId out of range`);
          continue;
        }

        if (name === 'PoolCreated')         await this._onPoolCreated(poolId, args[1], args[2]);
        else if (name === 'DepositMade')    await this._onDepositMade(poolId, args[1], args[2]);
        else if (name === 'Rewardreleased') await this._onRewardReleased(poolId, args[1], args[2]);
        else if (name === 'PoolCancelled')  await this._onPoolCancelled(poolId);
      } catch (err) {
        console.error('Error parsing log:', err.message);
      }
    }

    this._lastBlock = toBlock;
  }

  async _onPoolCreated(poolId, creator, initialDeposit) {
    try {
      console.log(`📍 PoolCreated: poolId=${poolId}, creator=${creator}, deposit=${initialDeposit}`);

      const poolState = {
        poolId: poolId.toString(),
        creator,
        status: 'ACTIVE',
        createdAt: Date.now(),
        playerCount: 1,
        totalDeposited: initialDeposit.toString(),
        handNumber: 0,
      };

      await this.redisClient.hSet(`room:${poolId}:state`, 'data', JSON.stringify(poolState));
      await this.redisClient.hSet(`room:${poolId}:players`, creator, 'joined');

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
      console.log(`💰 DepositMade: poolId=${poolId}, player=${participant}, amount=${amount}`);

      await this.redisClient.hSet(`room:${poolId}:players`, participant, JSON.stringify({
        status: 'joined',
        joinedAt: Date.now(),
        depositAmount: amount.toString(),
      }));

      const playerCount = await this.redisClient.hLen(`room:${poolId}:players`);
      console.log(`🎮 Pool ${poolId} has ${playerCount}/5 players`);

      if (playerCount === 5) {
        await this._startGame(poolId);
      }
    } catch (error) {
      console.error('Error handling DepositMade:', error);
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

      const poolKey = `room:${poolId}:state`;
      const poolState = await this.redisClient.hGetAll(poolKey);

      if (poolState?.data) {
        const state = JSON.parse(poolState.data);
        state.status = 'CLOSED';
        await this.redisClient.hSet(poolKey, 'data', JSON.stringify(state));
      }

      console.log(`✓ Pool ${poolId} marked as closed`);
    } catch (error) {
      console.error('Error handling PoolCancelled:', error);
    }
  }

  async _startGame(poolId) {
    try {
      console.log(`🚀 Starting game in pool ${poolId}`);

      const poolKey = `room:${poolId}:state`;
      const poolDataStr = await this.redisClient.hGetAll(poolKey);

      if (poolDataStr?.data) {
        const poolState = JSON.parse(poolDataStr.data);
        poolState.gameStarted = true;
        poolState.startedAt = Date.now();
        await this.redisClient.hSet(poolKey, 'data', JSON.stringify(poolState));
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
