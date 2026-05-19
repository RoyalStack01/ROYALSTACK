import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RoyalStack Server API',
      version: '1.0.0',
      description: 'Decentralized poker engine with provably fair shuffling. Real-time WebSocket-based game engine with blockchain settlement.',
      contact: {
        name: 'RoyalStack',
        url: 'https://royalstack.io',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://royalstack.onrender.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter the session token returned from /api/auth/verify',
        },
        adminSecret: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Admin-Secret',
          description: 'Admin secret key (set via WAITLIST_ADMIN_SECRET env var)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        PlayerStats: {
          type: 'object',
          properties: {
            handsPlayed: {
              type: 'integer',
              description: 'Total hands played',
            },
            handsWon: {
              type: 'integer',
              description: 'Total hands won',
            },
            totalWinnings: {
              type: 'number',
              description: 'Total winnings in the game',
            },
          },
        },
        LeaderboardEntry: {
          type: 'object',
          properties: {
            walletAddress: {
              type: 'string',
              description: 'Player wallet address',
            },
            handsPlayed: {
              type: 'integer',
            },
            handsWon: {
              type: 'integer',
            },
            totalWinnings: {
              type: 'number',
            },
          },
        },
        NonceResponse: {
          type: 'object',
          properties: {
            nonce: {
              type: 'string',
              description: 'Nonce to be signed by wallet',
            },
            walletAddress: {
              type: 'string',
              description: 'Wallet address',
            },
          },
        },
        AuthVerifyResponse: {
          type: 'object',
          properties: {
            sessionToken: {
              type: 'string',
              description: 'JWT session token for authenticated requests',
            },
            walletAddress: {
              type: 'string',
              description: 'Wallet address',
            },
            expiresIn: {
              type: 'integer',
              description: 'Token expiration time in seconds',
            },
          },
        },
        WaitlistJoinRequest: {
          type: 'object',
          required: ['walletAddress'],
          properties: {
            walletAddress: {
              type: 'string',
              pattern: '^0x[0-9a-fA-F]{40}$',
              description: 'EVM wallet address (the wallet you will use in-game)',
              example: '0x1234567890123456789012345678901234567890',
            },
            username: {
              type: 'string',
              pattern: '^[a-zA-Z0-9_.-]{1,30}$',
              description: 'Optional display username (1-30 alphanumeric chars)',
              example: 'cryptoking',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Optional email address for updates',
              example: 'player@example.com',
            },
            followedX: {
              type: 'boolean',
              description: 'Whether the user has followed @RoyalStack_ on X',
              example: true,
            },
          },
        },
        WaitlistJoinResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: "You're on the waitlist. Follow us on X for updates: https://x.com/RoyalStack_" },
          },
        },
        WaitlistEntry: {
          type: 'object',
          properties: {
            id:         { type: 'integer' },
            wallet:     { type: 'string', example: '0x1234...' },
            username:   { type: 'string', nullable: true },
            email:      { type: 'string', format: 'email', nullable: true },
            followed_x: { type: 'integer', enum: [0, 1] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        WaitlistAdminResponse: {
          type: 'object',
          properties: {
            count:   { type: 'integer' },
            entries: { type: 'array', items: { $ref: '#/components/schemas/WaitlistEntry' } },
          },
        },
        PoolState: {
          type: 'object',
          properties: {
            poolId: {
              type: 'string',
              description: 'Unique pool identifier',
            },
            creator: {
              type: 'string',
              description: 'Pool creator wallet address',
            },
            players: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'List of player wallet addresses',
            },
            status: {
              type: 'string',
              enum: ['waiting', 'inProgress', 'completed', 'cancelled'],
              description: 'Current pool status',
            },
          },
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check endpoint',
          description: 'Returns server status (no authentication required)',
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'ok',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/nonce': {
        post: {
          tags: ['Authentication'],
          summary: 'Generate a nonce for wallet authentication',
          description: 'Request a nonce to be signed by wallet. Rate limited to 20 requests per minute.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    walletAddress: {
                      type: 'string',
                      description: 'Ethereum wallet address',
                      example: '0x1234567890123456789012345678901234567890',
                    },
                  },
                  required: ['walletAddress'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Nonce generated successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/NonceResponse',
                  },
                },
              },
            },
            '400': {
              description: 'Missing wallet address',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/verify': {
        post: {
          tags: ['Authentication'],
          summary: 'Verify wallet signature and get session token',
          description: 'Verify a signed message and return a JWT session token. Rate limited to 20 requests per minute.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    walletAddress: {
                      type: 'string',
                      description: 'Ethereum wallet address',
                      example: '0x1234567890123456789012345678901234567890',
                    },
                    signature: {
                      type: 'string',
                      description: 'Signed message from wallet',
                      example: '0x1234...',
                    },
                    message: {
                      type: 'string',
                      description: 'The original message that was signed',
                    },
                  },
                  required: ['walletAddress', 'signature', 'message'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Authentication successful',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/AuthVerifyResponse',
                  },
                },
              },
            },
            '400': {
              description: 'Missing required fields',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '401': {
              description: 'Invalid signature',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout and invalidate session token',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Logged out successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        example: 'Logged out',
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/players/{walletAddress}/stats': {
        get: {
          tags: ['Player Stats'],
          summary: 'Get player statistics',
          description: 'Retrieve statistics for a specific player including hands played, won, and total winnings.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'walletAddress',
              in: 'path',
              required: true,
              description: 'Player wallet address',
              schema: {
                type: 'string',
                example: '0x1234567890123456789012345678901234567890',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Player statistics',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PlayerStats',
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '500': {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/leaderboard': {
        get: {
          tags: ['Leaderboard'],
          summary: 'Get leaderboard rankings',
          description: 'Retrieve the top players ranked by performance',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Number of top players to return (default: 10)',
              schema: {
                type: 'integer',
                default: 10,
                example: 10,
              },
            },
          ],
          responses: {
            '200': {
              description: 'Leaderboard data',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/LeaderboardEntry',
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '500': {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/hand/{handId}': {
        get: {
          tags: ['Hand History'],
          summary: 'Get hand details',
          description: 'Retrieve detailed information about a specific hand',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'handId',
              in: 'path',
              required: true,
              description: 'Hand ID',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Hand details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: true,
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '500': {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/pools/{poolId}': {
        get: {
          tags: ['Pools'],
          summary: 'Get pool state',
          description: 'Retrieve current state of a specific pool',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'poolId',
              in: 'path',
              required: true,
              description: 'Pool ID',
              schema: {
                type: 'string',
              },
            },
          ],
          responses: {
            '200': {
              description: 'Pool state',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/PoolState',
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '500': {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
      '/api/waitlist': {
        post: {
          tags: ['Waitlist'],
          summary: 'Join the RoyalStack waitlist',
          description: 'Submit your wallet address and optional username to join the early-access waitlist. Rate limited to 3 submissions per hour per IP. Same wallet address is deduplicated (upsert).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/WaitlistJoinRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Successfully joined the waitlist',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/WaitlistJoinResponse' },
                },
              },
            },
            '400': {
              description: 'Invalid wallet address or username',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '413': {
              description: 'Request body too large',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '415': {
              description: 'Content-Type must be application/json',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '429': {
              description: 'Rate limit exceeded (3 per hour per IP)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '500': {
              description: 'Server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
        get: {
          tags: ['Waitlist'],
          summary: 'List all waitlist entries (admin only)',
          description: 'Returns all waitlist entries ordered by signup date. Requires the `X-Admin-Secret` header matching the `WAITLIST_ADMIN_SECRET` environment variable. Returns 404 (not 403) if the secret is wrong to avoid leaking endpoint existence.',
          security: [{ adminSecret: [] }],
          responses: {
            '200': {
              description: 'Waitlist entries',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/WaitlistAdminResponse' },
                },
              },
            },
            '404': {
              description: 'Not found (wrong or missing admin secret)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '500': {
              description: 'Server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
      '/api/rooms/create': {
        post: {
          tags: ['Rooms'],
          summary: 'Create a new game room/pool',
          description: 'Create a new poker pool on-chain. Returns the poolId for the newly created pool.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Pool created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      poolId: {
                        type: 'string',
                        description: 'The ID of the newly created pool',
                      },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '503': {
              description: 'Admin wallet not configured',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            '500': {
              description: 'Server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
