const cors = require('cors');
const env = require('../config/env');

/**
 * CORS middleware for Express and Socket.io.
 * Only allows requests from the frontend URL.
 */
const corsMiddleware = cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

/**
 * CORS options object for Socket.io.
 */
const socketCorsOptions = {
  origin: env.FRONTEND_URL,
  credentials: true,
};

module.exports = { corsMiddleware, socketCorsOptions };
