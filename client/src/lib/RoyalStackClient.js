/**
 * ROYALSTACK Frontend WebSocket Client
 * Handles game connection, actions, and state management
 *
 * Usage:
 * const client = new RoyalStackClient('http://localhost:3002');
 * await client.auth.getNonce(walletAddress);
 * await client.auth.verify(walletAddress, signature, message);
 * await client.game.joinPool(poolId);
 * client.game.onGameStateUpdate((state) => console.log(state));
 * await client.game.sendAction({ type: 'bet', amount: 100 });
 */

export class RoyalStackClient {
  constructor(serverUrl = 'http://localhost:3002') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.sessionToken = null;
    this.walletAddress = null;

    this.auth = {
      getNonce: this.getNonce.bind(this),
      verify: this.verify.bind(this),
      logout: this.logout.bind(this),
    };

    this.game = {
      joinPool: this.joinPool.bind(this),
      sendAction: this.sendAction.bind(this),
      leavePool: this.leavePool.bind(this),
      onGameStateUpdate: this.onGameStateUpdate.bind(this),
      onGameOver: this.onGameOver.bind(this),
      onPlayerJoined: this.onPlayerJoined.bind(this),
    };

    this.stats = {
      getPlayerStats: this.getPlayerStats.bind(this),
      getLeaderboard: this.getLeaderboard.bind(this),
      getHandReplay: this.getHandReplay.bind(this),
    };

    this.listeners = {
      gameStateUpdate: null,
      gameOver: null,
      playerJoined: null,
      timerTick: null,
      actionError: null,
    };
  }

  // ============================================
  // Authentication
  // ============================================

  async getNonce(walletAddress) {
    try {
      const response = await fetch(`${this.serverUrl}/api/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      return data; // { nonce, message, expiresIn }
    } catch (error) {
      console.error('Error getting nonce:', error);
      throw error;
    }
  }

  async verify(walletAddress, signature, message) {
    try {
      const response = await fetch(`${this.serverUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signature, message }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Store session
      this.sessionToken = data.sessionToken;
      this.walletAddress = walletAddress;
      localStorage.setItem('sessionToken', data.sessionToken);
      localStorage.setItem('walletAddress', walletAddress);

      return data; // { sessionToken, walletAddress, expiresIn }
    } catch (error) {
      console.error('Error verifying signature:', error);
      throw error;
    }
  }

  async logout() {
    try {
      await fetch(`${this.serverUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.sessionToken}`,
        },
      });

      this.sessionToken = null;
      this.walletAddress = null;
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('walletAddress');

      if (this.socket) {
        this.socket.disconnect();
      }
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  // ============================================
  // Game Connection
  // ============================================

  connectWebSocket() {
    return new Promise((resolve, reject) => {
      if (!this.sessionToken) {
        reject(new Error('Not authenticated. Call auth.verify() first.'));
        return;
      }

      const { io } = window;
      if (!io) {
        reject(new Error('socket.io not loaded'));
        return;
      }

      this.socket = io(this.serverUrl, {
        auth: {
          token: this.sessionToken,
        },
      });

      this.socket.on('connect', () => {
        console.log('✓ Connected to game server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      // Listen for game events
      this.socket.on('GAME_STATE_UPDATED', (state) => {
        if (this.listeners.gameStateUpdate) {
          this.listeners.gameStateUpdate(state);
        }
      });

      this.socket.on('GAME_OVER', (result) => {
        if (this.listeners.gameOver) {
          this.listeners.gameOver(result);
        }
      });

      this.socket.on('PLAYER_JOINED', (data) => {
        if (this.listeners.playerJoined) {
          this.listeners.playerJoined(data);
        }
      });

      this.socket.on('TURN_TIMER_TICK', (data) => {
        if (this.listeners.timerTick) {
          this.listeners.timerTick(data);
        }
      });

      this.socket.on('ACTION_INVALID', (data) => {
        if (this.listeners.actionError) {
          this.listeners.actionError(data);
        }
      });
    });
  }

  // ============================================
  // Game Actions
  // ============================================

  async joinPool(poolId) {
    if (!this.socket) {
      await this.connectWebSocket();
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('JOIN_POOL', { poolId }, (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          console.log(`✓ Joined pool ${poolId}`);
          resolve(response);
        }
      });
    });
  }

  async sendAction(action) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to game server');
    }

    return new Promise((resolve, reject) => {
      this.socket.emit('PLAYER_ACTION', action, (response) => {
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async leavePool(poolId) {
    if (!this.socket) throw new Error('Not connected');

    return new Promise((resolve) => {
      this.socket.emit('LEAVE_POOL', { poolId }, () => {
        console.log(`✓ Left pool ${poolId}`);
        resolve();
      });
    });
  }

  // ============================================
  // Event Listeners
  // ============================================

  onGameStateUpdate(callback) {
    this.listeners.gameStateUpdate = callback;
  }

  onGameOver(callback) {
    this.listeners.gameOver = callback;
  }

  onPlayerJoined(callback) {
    this.listeners.playerJoined = callback;
  }

  onTimerTick(callback) {
    this.listeners.timerTick = callback;
  }

  onActionError(callback) {
    this.listeners.actionError = callback;
  }

  // ============================================
  // Statistics & History
  // ============================================

  async getPlayerStats(walletAddress) {
    try {
      const response = await fetch(
        `${this.serverUrl}/api/players/${walletAddress}/stats`,
        {
          headers: {
            Authorization: `Bearer ${this.sessionToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch stats');
      return await response.json();
    } catch (error) {
      console.error('Error fetching player stats:', error);
      throw error;
    }
  }

  async getLeaderboard(limit = 10) {
    try {
      const response = await fetch(
        `${this.serverUrl}/api/leaderboard?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${this.sessionToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return await response.json();
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  async getHandReplay(handId) {
    try {
      const response = await fetch(
        `${this.serverUrl}/api/hand/${handId}`,
        {
          headers: {
            Authorization: `Bearer ${this.sessionToken}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch hand');
      return await response.json();
    } catch (error) {
      console.error('Error fetching hand:', error);
      throw error;
    }
  }

  // ============================================
  // Restore Session
  // ============================================

  restoreSession() {
    const token = localStorage.getItem('sessionToken');
    const wallet = localStorage.getItem('walletAddress');

    if (token && wallet) {
      this.sessionToken = token;
      this.walletAddress = wallet;
      return true;
    }

    return false;
  }
}

// Export for use in browser or Node.js
if (typeof window !== 'undefined') {
  window.RoyalStackClient = RoyalStackClient;
}

export default RoyalStackClient;
