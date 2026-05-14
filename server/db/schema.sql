-- Poker Game History Schema for Turso (SQLite)

-- Hands table: summary of each completed game
CREATE TABLE IF NOT EXISTS hands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poolId INTEGER NOT NULL,
  handNumber INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  winner TEXT NOT NULL,
  potAmount INTEGER NOT NULL,
  stage TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Actions table: every bet, fold, call, raise, check
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handId INTEGER NOT NULL,
  playerId TEXT NOT NULL,
  action TEXT NOT NULL,
  amount INTEGER NOT NULL,
  stage TEXT NOT NULL,
  sequence INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (handId) REFERENCES hands(id)
);

-- Player stats table: aggregated performance per player
CREATE TABLE IF NOT EXISTS player_stats (
  playerId TEXT PRIMARY KEY,
  handsPlayed INTEGER DEFAULT 0,
  handsWon INTEGER DEFAULT 0,
  totalWinnings INTEGER DEFAULT 0,
  totalRakePaid INTEGER DEFAULT 0,
  lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pool stats: aggregated per pool
CREATE TABLE IF NOT EXISTS pool_stats (
  poolId INTEGER PRIMARY KEY,
  totalHands INTEGER DEFAULT 0,
  totalPotAmount INTEGER DEFAULT 0,
  totalRakeCollected INTEGER DEFAULT 0,
  lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_hands_poolId ON hands(poolId);
CREATE INDEX IF NOT EXISTS idx_hands_winner ON hands(winner);
CREATE INDEX IF NOT EXISTS idx_hands_timestamp ON hands(timestamp);
CREATE INDEX IF NOT EXISTS idx_actions_handId ON actions(handId);
CREATE INDEX IF NOT EXISTS idx_actions_playerId ON actions(playerId);
CREATE INDEX IF NOT EXISTS idx_player_stats_handsWon ON player_stats(handsWon DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_totalWinnings ON player_stats(totalWinnings DESC);
