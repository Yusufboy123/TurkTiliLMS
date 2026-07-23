import type { Request, Response } from 'express';
import { healthService } from '../services/health.service.js';

export const healthController = {
  getHealth(_request: Request, response: Response): void {
    response.status(200).json(healthService.getStatus());
  },
};
