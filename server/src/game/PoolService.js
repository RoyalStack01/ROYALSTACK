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

    // Room creator is stored separately — contract creator is the admin wallet, not the user
    const meta = await this.redis.hGetAll(`room:${sid}:meta`);
    const roomCreator = meta?.creator || null;

    const cached = await this.redis.hGetAll(`pool:${sid}`);
    if (cached && Object.keys(cached).length > 0) {
      const state = JSON.parse(Object.values(cached)[0]);
      return { ...state, creator: roomCreator ?? state.creator };
    }

    const onChain = await this.contract.pools(poolId);
    const state = {
      id: onChain.id.toString(),
      creator: roomCreator ?? onChain.creator,
      balance: onChain.balance.toString(),
      status: onChain.poolStatus === 0 ? 'ACTIVE' : 'CLOSED',
      participantCount: Number(onChain.participantCount),
      totalDeposited: onChain.totalDeposited.toString(),
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

  async addPlayerToPool(poolId, playerAddress) {
    const sid = safeId(poolId);

    // Merge with any existing record — EventListener may have already written
    // the verified on-chain stack from the DepositMade event.
    const existing = await this.redis.hGet(`room:${sid}:players`, playerAddress);
    const base = existing ? JSON.parse(existing) : {};

    const player = {
      ...base,
      address: playerAddress,
      joinedAt: base.joinedAt || Date.now(),
      status: 'pending', // stack is set later by EventListener from on-chain DepositMade
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
    const meta = await this.redis.hGetAll(`room:${sid}:meta`);
    const roomCreator = meta?.creator || null;

    const onChain = await this.contract.pools(poolId);
    const state = {
      id: onChain.id.toString(),
      creator: roomCreator ?? onChain.creator,
      balance: onChain.balance.toString(),
      status: onChain.poolStatus === 0 ? 'ACTIVE' : 'CLOSED',
      participantCount: Number(onChain.participantCount),
      totalDeposited: onChain.totalDeposited.toString(),
    };

    await this.redis.hSet(`pool:${sid}`, JSON.stringify(state));
    return state;
  }
}
