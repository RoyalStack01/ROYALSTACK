/**
 * Pool service - manages pool state and player registration
 */

/** Sanitize poolId before using it in Redis keys to prevent key injection. */
const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

export default class PoolService {
  constructor(redisClient, contract) {
    this.redis = redisClient;
    this.contract = contract;
  }

  async getPoolState(poolId) {
    const sid = safeId(poolId);
    const cached = await this.redis.hGetAll(`pool:${sid}`);
    if (cached && Object.keys(cached).length > 0) {
      return JSON.parse(Object.values(cached)[0]);
    }

    const onChain = await this.contract.pools(poolId);
    const state = {
      id: onChain.id.toString(),
      creator: onChain.creator,
      balance: onChain.balance.toString(),
      status: onChain.poolStatus === 0 ? 'ACTIVE' : 'CLOSED',
      participants: onChain.participants.filter(
        addr => addr !== '0x0000000000000000000000000000000000000000'
      ),
      playerCount: onChain.participants.filter(
        addr => addr !== '0x0000000000000000000000000000000000000000'
      ).length,
    };

    await this.redis.hSet(`pool:${sid}`, JSON.stringify(state));
    return state;
  }

  async getPlayerInPool(poolId, playerAddress) {
    const sid = safeId(poolId);
    const players = await this.redis.hGetAll(`room:${sid}:players`);
    if (players[playerAddress]) {
      return JSON.parse(players[playerAddress]);
    }
    return null;
  }

  async addPlayerToPool(poolId, playerAddress, depositAmount) {
    const sid = safeId(poolId);
    const player = {
      address: playerAddress,
      stack: parseInt(depositAmount),
      joinedAt: Date.now(),
      status: 'active',
    };

    await this.redis.hSet(
      `room:${sid}:players`,
      playerAddress,
      JSON.stringify(player)
    );

    const playerCount = await this.redis.hLen(`room:${sid}:players`);
    return playerCount;
  }

  async getPoolPlayers(poolId) {
    const sid = safeId(poolId);
    const players = await this.redis.hGetAll(`room:${sid}:players`);
    return Object.values(players).map(p => JSON.parse(p));
  }

  async getAllPools() {
    const keys = await this.redis.keys('pool:*');
    return keys.map(k => k.match(/pool:(\d+)/)[1]);
  }

  async syncPoolFromChain(poolId) {
    const sid = safeId(poolId);
    const onChain = await this.contract.pools(poolId);
    const state = {
      id: onChain.id.toString(),
      creator: onChain.creator,
      balance: onChain.balance.toString(),
      status: onChain.poolStatus === 0 ? 'ACTIVE' : 'CLOSED',
      participants: onChain.participants.filter(
        addr => addr !== '0x0000000000000000000000000000000000000000'
      ),
    };

    await this.redis.hSet(`pool:${sid}`, JSON.stringify(state));
    return state;
  }
}
