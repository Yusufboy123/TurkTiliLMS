import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new AppError(`Route not found: ${request.method} ${request.originalUrl}`, 404));
};
