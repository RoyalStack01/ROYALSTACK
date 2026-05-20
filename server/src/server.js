/**
 * Server initialization and wiring.
 * Connects all components: auth, game engine, database, WebSocket, REST API.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createClient } from '@libsql/client';
import redis from 'redis';
import { ethers } from 'ethers';
import { createRequire } from 'module';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const POOL_ABI = require('./chain/abis/Pool.json');

// Import services
import { WalletAuthService } from './auth/WalletAuthService.js';
import { authMiddleware, wsAuthMiddleware } from './auth/authMiddleware.js';
import TursoClient from './db/TursoClient.js';
import HandHistorian from './db/HandHistorian.js';
import { GameStateMachine } from './engine/GameStateMachine.js';
import { Deck } from './engine/Deck.js';
import { BlindManager } from './engine/BlindManager.js';
import { TurnTimer } from './engine/TurnTimer.js';
import { ActionValidator } from './engine/ActionValidator.js';
import { ShowdownResolver } from './engine/ShowdownResolver.js';
import { SidePotCalculator } from './engine/SidePotCalculator.js';
import CommitStore from './oracle/CommitStore.js';
import ProofVerifier from './oracle/ProofVerifier.js';
import EventListener from './chain/EventListener.js';
import GameRoomManager from './game/GameRoomManager.js';
import PoolService from './game/PoolService.js';
import PoolCancellationManager from './game/PoolCancellationManager.js';
import { createAdminRoutes } from './routes/admin.js';
import { createPoolRoutes } from './routes/pools.js';
import { createWaitlistRoutes, createWaitlistTable } from './routes/waitlist.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';

const maskAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

// Maps engine-internal player fields to the shape LiveGameTable expects
function normalizeGameState(state) {
  if (!state || !Array.isArray(state.players)) return null;
  return {
    ...state,
    // Engine uses activePlayerId; frontend expects currentPlayer
    currentPlayer: state.currentPlayer ?? state.activePlayerId ?? null,
    players: state.players.map(p => ({
      ...p,
      walletAddress: p.walletAddress ?? p.address ?? p.id ?? '',
      chips:         p.chips         ?? p.stack          ?? 0,
      bet:           p.bet           ?? p.betThisStreet   ?? 0,
      holeCards:     p.holeCards     ?? p.hand            ?? [],
    })),
  };
}

// Emit game state to each socket in a room with opponent cards stripped.
// Each player only receives their own holeCards; opponents get an empty array
// unless it's a showdown (winners array is non-empty).
function emitGameStateToRoom(io, room, state) {
  const isShowdown = Array.isArray(state.winners) && state.winners.length > 0;
  const roomSockets = io.sockets.adapter.rooms.get(room);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;
    const addr = (s.data?.walletAddress ?? '').toLowerCase();
    const perPlayer = {
      ...state,
      players: state.players.map(p => ({
        ...p,
        holeCards: isShowdown || p.walletAddress.toLowerCase() === addr
          ? p.holeCards
          : [],
      })),
    };
    s.emit('GAME_STATE_UPDATED', perPlayer);
  }
}

export async function initializeServer() {
  try {
    console.log('🚀 Starting server initialization...');

    // ============================================
    // 1. Initialize External Services
    // ============================================

    // Redis (ephemeral game state)
    console.log('📍 Connecting to Redis...');
    const redisClient = redis.createClient({
      url: process.env.REDIS_URL,
    });
    await redisClient.connect();
    console.log('✓ Redis connected');

    // Turso (persistent game history)
    console.log('📍 Connecting to Turso...');
    const tursoClient = new TursoClient(
      process.env.TURSO_CONNECTION_URL,
      process.env.TURSO_AUTH_TOKEN
    );
    const isTursoConnected = await tursoClient.ping();
    if (!isTursoConnected) throw new Error('Turso connection failed');
    console.log('✓ Turso connected');
    await tursoClient.createTables();
    console.log('✓ Game tables ready');
    await createWaitlistTable(tursoClient);
    console.log('✓ Waitlist table ready');

    // ============================================
    // 2. Initialize Game Engine Components
    // ============================================

    console.log('📍 Initializing game engine...');
    const deck = new Deck();
    const blindManager = new BlindManager(50, 100); // SB=50, BB=100
    const turnTimer = new TurnTimer();
    const actionValidator = ActionValidator;
    const showdownResolver = ShowdownResolver;
    const sidePotCalculator = SidePotCalculator;

    const gameStateMachine = new GameStateMachine({
      deck,
      blindManager,
      turnTimer,
      actionValidator,
      showdownResolver,
      sidePotCalculator,
    });
    console.log('✓ Game engine initialized');

    // ============================================
    // 3. Initialize Blockchain Components
    // ============================================

    console.log('📍 Initializing blockchain components...');
    const commitStore = new CommitStore(redisClient);
    const proofVerifier = new ProofVerifier(commitStore);
    const historian = new HandHistorian(tursoClient);

    const contractAddress = process.env.POOL_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
    const eventListenerConfig = {
      contractAddress,
      redisClient,
      historian,
    };

    const eventListener = new EventListener(eventListenerConfig);

    if (contractAddress && contractAddress !== '0x...') {
      await eventListener.start();
      console.log('✓ Event listener started');
    } else {
      console.log('⚠ Event listener skipped (CONTRACT_ADDRESS not configured)');
    }

    // Admin wallet — signs createPool, cancelPool, awardPot on behalf of the server
    let signedContract = null;
    let poolCreating = false; // mutex: admin wallet has one nonce at a time
    if (process.env.ADMIN_PRIVATE_KEY && eventListener.provider) {
      const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, eventListener.provider);
      signedContract = new ethers.Contract(contractAddress, POOL_ABI, adminWallet);
      console.log('✓ Admin wallet loaded');
    } else {
      console.warn('⚠ ADMIN_PRIVATE_KEY not set — createPool/cancelPool/awardPot will be unavailable');
    }

    const gameRoomManager = new GameRoomManager(
      redisClient,
      gameStateMachine,
      historian,
      signedContract
    );
    const poolService = new PoolService(redisClient, eventListener.contract);
    const cancellationManager = new PoolCancellationManager(
      redisClient,
      signedContract,
      poolService
    );

    eventListener.cancellationManager = cancellationManager;

    // io is wired below after socket server is created
    // Re-arm cancellation timers for pools that were active before this restart
    await cancellationManager.restoreTimeouts();

    console.log('✓ Blockchain components initialized');

    // ============================================
    // 4. Initialize Authentication
    // ============================================

    console.log('📍 Initializing authentication...');
    const authService = new WalletAuthService(redisClient);
    console.log('✓ Authentication initialized');

    // ============================================
    // 5. Initialize Express & WebSocket
    // ============================================

    console.log('📍 Setting up Express and WebSocket...');
    const app = express();
    const httpServer = createServer(app);
    const io = new SocketServer(httpServer, {
      cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' },
      maxHttpBufferSize: 1e5,
    });

    app.use(cors({ origin: true, credentials: true }));

    // Request timeout middleware (30 seconds)
    app.use((req, res, next) => {
      res.setTimeout(30000, () => {
        res.status(503).json({ error: 'Request timeout' });
      });
      next();
    });

    app.use(express.json());

    // ============================================
    // Swagger API Documentation
    // ============================================
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      swaggerOptions: {
        persistAuthorization: true,
        displayOperationId: true,
      },
    }));

    // Simple in-memory IP-based rate limiter for auth endpoints
    const authRateLimitMap = new Map();
    const AUTH_RATE_LIMIT = 20;
    const AUTH_RATE_WINDOW = 60 * 1000; // 1 minute

    const authRateLimiter = (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const entry = authRateLimitMap.get(ip) || { count: 0, windowStart: now };

      if (now - entry.windowStart > AUTH_RATE_WINDOW) {
        entry.count = 0;
        entry.windowStart = now;
      }

      entry.count += 1;
      authRateLimitMap.set(ip, entry);

      if (entry.count > AUTH_RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests, please try again later' });
      }

      next();
    };

    // ============================================
    // 6. REST API Routes (Auth)
    // ============================================

    app.post('/api/auth/nonce', authRateLimiter, async (req, res) => {
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      try {
        const result = await authService.generateNonce(walletAddress);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/auth/verify', authRateLimiter, async (req, res) => {
      const { walletAddress, signature, message } = req.body;

      if (!walletAddress || !signature || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      try {
        const result = await authService.verifySignature(
          walletAddress,
          signature,
          message
        );

        if (!result.valid) {
          return res.status(401).json({ error: result.error });
        }

        res.json({
          sessionToken: result.sessionToken,
          walletAddress: result.walletAddress,
          expiresIn: result.expiresIn,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/auth/logout', authMiddleware(authService), async (req, res) => {
      const token = req.headers.authorization?.split(' ')[1];
      await authService.logout(token);
      res.json({ message: 'Logged out' });
    });

    // ============================================
    // 7. REST API Routes (Game Stats - Protected)
    // ============================================

    app.get(
      '/api/players/:walletAddress/stats',
      authMiddleware(authService),
      async (req, res) => {
        try {
          const stats = await tursoClient.getPlayerStats(
            req.params.walletAddress
          );
          res.json(stats || { handsPlayed: 0, handsWon: 0, totalWinnings: 0 });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    app.get('/api/leaderboard', authMiddleware(authService), async (req, res) => {
      try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const leaderboard = await tursoClient.getLeaderboard(limit);
        res.json(leaderboard);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get(
      '/api/hand/:handId',
      authMiddleware(authService),
      async (req, res) => {
        try {
          const hand = await tursoClient.getHandDetails(req.params.handId);
          res.json(hand);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      }
    );

    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Create a new pool — server calls createPool() on-chain, returns poolId to frontend
    app.post('/api/rooms/create', authMiddleware(authService), async (req, res) => {
      if (!signedContract) {
        return res.status(503).json({ error: 'Admin wallet not configured' });
      }
      if (poolCreating) {
        return res.status(429).json({ error: 'A pool is already being created. Please wait a moment.' });
      }
      poolCreating = true;
      try {
        const tx = await signedContract.createPool();
        const receipt = await tx.wait();

        // Parse PoolCreated event from receipt to get poolId
        const iface = new ethers.Interface(POOL_ABI);
        const log = receipt.logs.find(l => {
          try { return iface.parseLog(l)?.name === 'PoolCreated'; } catch { return false; }
        });

        if (!log) {
          return res.status(500).json({ error: 'Pool created but poolId not found in receipt' });
        }

        const poolId = iface.parseLog(log).args[0].toString();

        // Store the initiating user as room creator — contract creator is admin wallet, not the user
        await redisClient.hSet(`room:${poolId}:meta`, 'creator', req.user.walletAddress);

        console.log(`✓ Pool ${poolId} created by server for ${req.user.walletAddress}`);
        res.json({ poolId });
      } catch (error) {
        console.error('Error creating pool:', error.message);
        res.status(500).json({ error: error.message });
      } finally {
        poolCreating = false;
      }
    });

    // ============================================
    // 7. Admin Routes
    // ============================================

    createAdminRoutes(app, authService, poolService, gameRoomManager, tursoClient, signedContract);

    // ============================================
    // 7B. Pool Management Routes
    // ============================================

    createPoolRoutes(app, authService, poolService, cancellationManager);

    // ============================================
    // 7C. Waitlist Routes (public)
    // ============================================

    createWaitlistRoutes(app, tursoClient, process.env.WAITLIST_ADMIN_SECRET);

    // ============================================
    // 8. WebSocket Handlers (Game)
    // ============================================

    cancellationManager.io = io;
    eventListener.io = io;
    eventListener.gameRoomManager = gameRoomManager;

    io.use(wsAuthMiddleware(authService));

    io.on('connection', async (socket) => {
      if (!socket.user?.walletAddress) {
        socket.disconnect(true);
        return;
      }

      const { walletAddress } = socket.user;
      socket.data.walletAddress = walletAddress; // needed by emitGameStateToRoom
      console.log(`✓ ${maskAddress(walletAddress)} connected`);

      // Per-socket rate limiting for PLAYER_ACTION: max 10 per 5 seconds
      let actionCount = 0;
      let actionWindowStart = Date.now();
      const ACTION_RATE_LIMIT = 10;
      const ACTION_RATE_WINDOW = 5000;

      socket.on('JOIN_POOL', async (data) => {
        const { poolId } = data;

        // If pool already closed, tell client immediately
        const roomRaw = await redisClient.hGet(`room:${poolId}:state`, 'data');
        if (roomRaw) {
          const roomState = JSON.parse(roomRaw);
          if (roomState.status === 'CLOSED') {
            socket.emit('POOL_CANCELLED', { poolId, reason: 'already_closed' });
            return;
          }
        }

        const alreadyIn = await redisClient.hExists(`room:${poolId}:players`, walletAddress);

        // Only write a placeholder if there's no existing record — don't overwrite
        // an 'active' entry that EventListener already confirmed from on-chain deposit
        if (!alreadyIn) {
          await redisClient.hSet(
            `room:${poolId}:players`,
            walletAddress,
            JSON.stringify({ address: walletAddress, status: 'joined', joinedAt: Date.now() })
          );
        }

        socket.join(`pool:${poolId}`);

        if (!alreadyIn) {
          socket.emit('POOL_JOINED', { poolId, walletAddress });
          socket.to(`pool:${poolId}`).emit('PLAYER_JOINED', { walletAddress });
        }

        // If game already started (on-chain deposit beat socket join), sync state to late joiner
        const stateRaw = await redisClient.hGet(`room:${poolId}:state`, 'data');
        if (stateRaw) {
          const st = JSON.parse(stateRaw);
          if (st.gameStarted && gameRoomManager) {
            const gameState = normalizeGameState(await gameRoomManager.getRoom(poolId.toString()));
            if (gameState) {
              const isShowdown = Array.isArray(gameState.winners) && gameState.winners.length > 0;
              const forSelf = {
                ...gameState,
                players: gameState.players.map(p => ({
                  ...p,
                  holeCards: isShowdown || p.walletAddress.toLowerCase() === walletAddress.toLowerCase()
                    ? p.holeCards
                    : [],
                })),
              };
              socket.emit('GAME_STATE_UPDATED', forSelf);
            }
            // if null, client stays on waiting screen — game will restart on next pool fill
          }
        }
      });

      socket.on('PLAYER_ACTION', async (data) => {
        // Rate limit check
        const now = Date.now();
        if (now - actionWindowStart > ACTION_RATE_WINDOW) {
          actionCount = 0;
          actionWindowStart = now;
        }
        actionCount += 1;
        if (actionCount > ACTION_RATE_LIMIT) {
          socket.emit('ACTION_INVALID', { error: 'Too many actions, slow down' });
          return;
        }

        const { poolId, action } = data;
        const state = gameStateMachine.applyAction(walletAddress, action);

        if (state.error) {
          socket.emit('ACTION_INVALID', { error: state.error });
          return;
        }

        const normalized = normalizeGameState(state);
        if (normalized) emitGameStateToRoom(io, `pool:${poolId}`, normalized);

        if (state.stage === 'showdown') {
          try {
            await historian.saveHand(
              poolId,
              state.handNumber,
              state,
              state.sidePots,
              state.winners
            );
            io.to(`pool:${poolId}`).emit('HAND_SAVED', {
              handId: state.handId,
            });
          } catch (error) {
            console.error('Error saving hand:', error);
          }
        }
      });

      socket.on('LEAVE_POOL', async (data) => {
        const { poolId } = data;
        await redisClient.hDel(`room:${poolId}:players`, walletAddress);
        socket.leave(`pool:${poolId}`);
        socket.to(`pool:${poolId}`).emit('PLAYER_LEFT', { walletAddress });
      });

      socket.on('disconnect', async () => {
        console.log(`✗ ${maskAddress(walletAddress)} disconnected`);
      });
    });

    // ============================================
    // 9. Start Server
    // ============================================

    const PORT = process.env.PORT || 3002;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`${signal} received. Shutting down gracefully...`);
      httpServer.close(async () => {
        try {
          await redisClient.quit();
          console.log('✓ Redis closed');
        } catch (err) {
          console.error('Error closing Redis:', err.message);
        }
        process.exit(0);
      });

      // Force exit after 10 seconds if server doesn't close
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return {
      app,
      httpServer,
      io,
      redisClient,
      tursoClient,
      authService,
      gameStateMachine,
      historian,
      eventListener,
    };
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    console.error(error);
    throw error;
  }
}

// Start if run directly
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  initializeServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
