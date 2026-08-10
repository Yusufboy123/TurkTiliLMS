import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  studentMonitoringIdSchema,
  studentMonitoringQuerySchema,
} from './student-monitoring.schemas.js';
import type { StudentMonitoringService } from './student-monitoring.service.js';

function actor(request: Request) {
  const principal = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!principal)
    throw new AppError(
      'Davom etish uchun tizimga kirish talab qilinadi.',
      401,
      'AUTHENTICATION_REQUIRED',
    );
  return { userId: principal.userId, roles: principal.roles, permissions: principal.permissions };
}

export class StudentMonitoringController {
  constructor(private readonly service: StudentMonitoringService) {}
  list = async (request: Request, response: Response): Promise<void> => {
    response.json({
      success: true,
      message: 'Talabalar ro‘yxati olindi.',
      data: await this.service.list(
        studentMonitoringQuerySchema.parse(request.query),
        actor(request),
      ),
    });
  };
  getById = async (request: Request, response: Response): Promise<void> => {
    response.json({
      success: true,
      message: 'Talaba ma’lumotlari olindi.',
      data: await this.service.getById(
        studentMonitoringIdSchema.parse(request.params).studentId,
        actor(request),
      ),
    });
  };
}
