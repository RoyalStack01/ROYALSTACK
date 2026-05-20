/**
 * Pool service - manages pool state and player registration
 */

/** Sanitize poolId before using it in Redis keys to prevent key injection. */
const safeId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

function parseOnChain(onChain, roomCreator) {
  return {
    id: onChain.id.toString(),
    creator: roomCreator ?? onChain.creator,
    status: onChain.poolStatus === 0 ? 'ACTIVE' : 'CLOSED',
    playerCount: Number(onChain.participantCount),
    totalDeposited: onChain.totalDeposited.toString(),
  };
}

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

    // Check EventListener's namespace first (room:N:state), then pool:N cache
    const roomState = await this.redis.hGet(`room:${sid}:state`, 'data');
    if (roomState) {
      const state = JSON.parse(roomState);
      // Normalise field name so routes can rely on playerCount
      if (state.playerCount === undefined && state.participantCount !== undefined) {
        state.playerCount = state.participantCount;
      }
      return { ...state, creator: roomCreator ?? state.creator };
    }

    const cached = await this.redis.get(`pool:${sid}`);
    if (cached) {
      const state = JSON.parse(cached);
      return { ...state, creator: roomCreator ?? state.creator };
    }

    const onChain = await this.contract.pools(poolId);
    const state = parseOnChain(onChain, roomCreator);

    await this.redis.set(`pool:${sid}`, JSON.stringify(state));
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
      // Preserve 'active' if EventListener already confirmed the deposit; otherwise 'pending'
      status: base.status === 'active' ? 'active' : 'pending',
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
    return Object.entries(players).map(([addr, raw]) => {
      const p = JSON.parse(raw);
      // Hash key is the canonical address — include it if the value omits it
      if (!p.address) p.address = addr;
      return p;
    });
  }

  async getAllPools() {
    // EventListener writes room state to room:N:state; pool:N is only written
    // after a getPoolState on-chain call. Check both namespaces.
    const [roomKeys, poolKeys] = await Promise.all([
      this.redis.keys('room:*:state'),
      this.redis.keys('pool:*'),
    ]);
    const ids = new Set();
    roomKeys.forEach(k => { const m = k.match(/room:(\d+):state/); if (m) ids.add(m[1]); });
    poolKeys.forEach(k => { const m = k.match(/^pool:(\d+)$/); if (m) ids.add(m[1]); });
    return [...ids];
  }

  async syncPoolFromChain(poolId) {
    const sid = safeId(poolId);
    const meta = await this.redis.hGetAll(`room:${sid}:meta`);
    const roomCreator = meta?.creator || null;

    const onChain = await this.contract.pools(poolId);
    const state = parseOnChain(onChain, roomCreator);

    await this.redis.set(`pool:${sid}`, JSON.stringify(state));
    return state;
  }
}
