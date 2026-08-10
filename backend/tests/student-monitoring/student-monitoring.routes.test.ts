import { RoleCode, SessionClientType } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import { StudentMonitoringController } from '../../src/modules/student-monitoring/student-monitoring.controller.js';
import { createStudentMonitoringRouter } from '../../src/modules/student-monitoring/student-monitoring.routes.js';
import { StudentMonitoringService } from '../../src/modules/student-monitoring/student-monitoring.service.js';
import type { StudentMonitoringRepository } from '../../src/modules/student-monitoring/student-monitoring.repository.js';

class EmptyRepository implements StudentMonitoringRepository {
  async listStudents() {
    return { students: [], total: 0, newStudentCount: 0 };
  }
  async listEnrollments() {
    return new Map();
  }
  async findStudent() {
    return null;
  }
  async findStudentEnrollments() {
    return [];
  }
  async studentHasScopedEnrollment() {
    return false;
  }
}
describe('Student monitoring routes', () => {
  it('denies a student before monitoring handlers execute', async () => {
    const app = express();
    app.use(express.json());
    app.use((request, _response, next) => {
      (request as typeof request & { auth?: unknown }).auth = {
        userId: 'student',
        sessionId: 'session',
        clientType: SessionClientType.WEB,
        roles: [RoleCode.STUDENT],
        permissions: ['progress.course.read'],
      };
      next();
    });
    app.use(
      '/api/v1/students',
      createStudentMonitoringRouter(
        new StudentMonitoringController(new StudentMonitoringService(new EmptyRepository())),
        (_request, _response, next) => next(),
        requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
        requirePermission,
      ),
    );
    app.use(errorHandler);
    const response = await request(app).get('/api/v1/students').expect(403);
    expect(response.body.code ?? response.body.error?.code).toBe('ACCESS_DENIED');
  });
});
