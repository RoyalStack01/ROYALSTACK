/**
 * React Hook for RoyalStackClient
 * Provides authentication, game state, and stats management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import RoyalStackClient from '../lib/RoyalStackClient';

export function useRoyalStack(serverUrl = 'http://localhost:3002') {
  const clientRef = useRef(null);
  const [sessionToken, setSessionToken] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [playerStats, setPlayerStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Initialize client
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = new RoyalStackClient(serverUrl);

      // Set up event listeners
      clientRef.current.onGameStateUpdate((state) => {
        setGameState(state);
      });

      clientRef.current.onActionError((error) => {
        setError(error.error);
      });
    }

    // Try to restore session from localStorage
    if (clientRef.current.restoreSession()) {
      setSessionToken(clientRef.current.sessionToken);
      setWalletAddress(clientRef.current.walletAddress);
    }
  }, [serverUrl]);

  // ============================================
  // Authentication
  // ============================================

  const getNonce = useCallback(async (wallet) => {
    try {
      setLoading(true);
      setError(null);
      const result = await clientRef.current.auth.getNonce(wallet);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifySignature = useCallback(async (wallet, signature, message) => {
    try {
      setLoading(true);
      setError(null);
      const result = await clientRef.current.auth.verify(wallet, signature, message);
      setSessionToken(result.sessionToken);
      setWalletAddress(wallet);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await clientRef.current.auth.logout();
      setSessionToken(null);
      setWalletAddress(null);
      setGameState(null);
      setPlayerStats(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // Game
  // ============================================

  const joinPool = useCallback(async (poolId) => {
    try {
      setLoading(true);
      setError(null);
      await clientRef.current.game.joinPool(poolId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendAction = useCallback(async (action) => {
    try {
      setError(null);
      await clientRef.current.game.sendAction(action);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const leavePool = useCallback(async (poolId) => {
    try {
      setLoading(true);
      await clientRef.current.game.leavePool(poolId);
      setGameState(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // Statistics
  // ============================================

  const fetchPlayerStats = useCallback(async (wallet = walletAddress) => {
    if (!wallet) {
      setError('No wallet address provided');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const stats = await clientRef.current.stats.getPlayerStats(wallet);
      setPlayerStats(stats);
      return stats;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  const fetchLeaderboard = useCallback(async (limit = 10) => {
    try {
      setLoading(true);
      setError(null);
      return await clientRef.current.stats.getLeaderboard(limit);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHandReplay = useCallback(async (handId) => {
    try {
      setLoading(true);
      setError(null);
      return await clientRef.current.stats.getHandReplay(handId);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    sessionToken,
    walletAddress,
    gameState,
    playerStats,
    error,
    loading,
    isAuthenticated: !!sessionToken,

    // Auth
    getNonce,
    verifySignature,
    logout,

    // Game
    joinPool,
    sendAction,
    leavePool,

    // Stats
    fetchPlayerStats,
    fetchLeaderboard,
    fetchHandReplay,

    // Raw client for advanced usage
    client: clientRef.current,
  };
}

export default useRoyalStack;
