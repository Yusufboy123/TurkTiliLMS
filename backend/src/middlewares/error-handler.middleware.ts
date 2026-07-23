import type { ErrorRequestHandler } from 'express';
import { environment } from '../config/environment.js';
import { AppError } from '../utils/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const isKnownError = error instanceof AppError;
  const statusCode = isKnownError ? error.statusCode : 500;
  const message = isKnownError ? error.message : 'Internal server error';

  response.status(statusCode).json({
    success: false,
    message,
    ...(environment.NODE_ENV === 'development' && error instanceof Error
      ? { stack: error.stack }
      : {}),
  });
};
