import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { environment } from '../config/environment.js';
import { AppError } from '../utils/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Kiritilgan ma’lumotlarni tekshiring.',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const isKnownError = error instanceof AppError;
  const statusCode = isKnownError ? error.statusCode : 500;
  const message = isKnownError ? error.message : 'Serverda ichki xatolik yuz berdi.';

  if (!isKnownError) {
    const requestLogger = (request as typeof request & { log?: Logger }).log;
    requestLogger?.error({ err: error }, 'Unhandled request error');
  }

  response.status(statusCode).json({
    success: false,
    code: isKnownError ? error.code : 'INTERNAL_SERVER_ERROR',
    message,
    ...(isKnownError && error.details !== undefined ? { details: error.details } : {}),
    ...(environment.NODE_ENV === 'development' && error instanceof Error
      ? { stack: error.stack }
      : {}),
  });
};
