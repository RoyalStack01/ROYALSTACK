import pino from 'pino';
import env from './env.js';

const isDev = env.NODE_ENV === 'development';

const transport = isDev
    ? pino.transport({
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
        },
    })
    : pino.transport({
        target: 'pino/file',
        options: { destination: './server.log', append: true },
    });

export const logger = pino({ level: isDev ? 'debug' : 'info' }, transport);
