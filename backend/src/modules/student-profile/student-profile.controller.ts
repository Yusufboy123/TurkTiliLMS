import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import { updateStudentProfileSchema } from './student-profile.schemas.js';
import type { StudentProfileService } from './student-profile.service.js';

function principal(request: Request): AuthenticatedPrincipal {
  const value = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!value) {
    throw new AppError(
      'Davom etish uchun tizimga kirish talab qilinadi.',
      401,
      'AUTHENTICATION_REQUIRED',
    );
  }
  return value;
}

function actor(request: Request) {
  const value = principal(request);
  return { userId: value.userId, roles: value.roles };
}

export class StudentProfileController {
  constructor(private readonly service: StudentProfileService) {}

  get = async (request: Request, response: Response): Promise<void> => {
    response.json({
      success: true,
      message: 'Talaba profili olindi.',
      data: await this.service.get(actor(request)),
    });
  };

  update = async (request: Request, response: Response): Promise<void> => {
    response.json({
      success: true,
      message: 'Talaba profili saqlandi.',
      data: await this.service.update(updateStudentProfileSchema.parse(request.body), actor(request)),
    });
  };
}
