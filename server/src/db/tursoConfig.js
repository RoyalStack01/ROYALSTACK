// Turso database configuration
// Set these environment variables in your .env file

export const tursoConfig = {
  // Get these from https://turso.tech dashboard
  connectionUrl: process.env.TURSO_CONNECTION_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,

  // Initialize Turso client
  init() {
    if (!this.connectionUrl || !this.authToken) {
      throw new Error(
        "Missing Turso credentials. Set TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN in .env"
      );
    }

    const TursoClient = require("./TursoClient").default;
    return new TursoClient(this.connectionUrl, this.authToken);
  },
};

/**
 * Usage in server initialization:
 *
 * import { tursoConfig } from './tursoConfig.js';
 * import HandHistorian from './db/HandHistorian.js';
 *
 * const tursoClient = tursoConfig.init();
 * const historian = new HandHistorian(tursoClient);
 *
 * // Verify connection
 * const isConnected = await tursoClient.ping();
 * if (!isConnected) {
 *   throw new Error('Failed to connect to Turso database');
 * }
 */
