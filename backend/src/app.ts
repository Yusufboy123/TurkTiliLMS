import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { environment } from './config/environment.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { requestLogger } from './middlewares/request-logger.middleware.js';
import {
  createCredentialedCorsOptions,
  createRejectUntrustedOrigin,
} from './middlewares/trusted-origin.middleware.js';
import { apiV1Router } from './routes/index.js';

export const app = express();
const trustedFrontendOrigins = environment.FRONTEND_ORIGINS;

app.disable('x-powered-by');
app.use(helmet());
app.use(createRejectUntrustedOrigin(trustedFrontendOrigins));
app.use(cors(createCredentialedCorsOptions(trustedFrontendOrigins)));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use('/api/v1', apiV1Router);

if (environment.FRONTEND_STATIC_ROOT) {
  const frontendRoot = resolve(environment.FRONTEND_STATIC_ROOT);
  app.use(express.static(frontendRoot, { index: false }));
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) {
      next();
      return;
    }
    response.sendFile('index.html', { root: frontendRoot });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);
