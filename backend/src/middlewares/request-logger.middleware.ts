import { pinoHttp, stdSerializers, type Options } from 'pino-http';
import type { DestinationStream } from 'pino';
import { environment } from '../config/environment.js';

const publicVerificationPathPattern = /(\/api\/v1\/public\/certificates\/verify\/)[^/?#]+/giu;

export function redactSensitiveRequestUrl(url: string): string {
  return url.replace(publicVerificationPathPattern, '$1[REDACTED]');
}

const requestLoggerOptions: Options = {
  level: environment.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
  serializers: {
    req(request) {
      const serialized = stdSerializers.req(request);
      return {
        ...serialized,
        url:
          typeof serialized.url === 'string'
            ? redactSensitiveRequestUrl(serialized.url)
            : serialized.url,
      };
    },
  },
};

export function createRequestLogger(destination?: DestinationStream) {
  return pinoHttp(requestLoggerOptions, destination);
}

export const requestLogger = createRequestLogger();
