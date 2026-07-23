import { pinoHttp } from 'pino-http';
import { environment } from '../config/environment.js';

export const requestLogger = pinoHttp({
  level: environment.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
});
