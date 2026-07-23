import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { environment } from './config/environment.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { requestLogger } from './middlewares/request-logger.middleware.js';
import { apiV1Router } from './routes/index.js';

export const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: environment.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.use('/api/v1', apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);
