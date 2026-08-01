import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
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
const trustedFrontendOrigins = new Set([environment.FRONTEND_URL]);

app.disable('x-powered-by');
app.use(helmet());
app.use(createRejectUntrustedOrigin(trustedFrontendOrigins));
app.use(cors(createCredentialedCorsOptions(trustedFrontendOrigins)));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use('/api/v1', apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);
