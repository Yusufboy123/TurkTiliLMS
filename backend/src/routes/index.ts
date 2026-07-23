import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { courseCatalogRouter, courseRouter } from '../modules/courses/course.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { userManagementRouter } from '../modules/users/user-management.routes.js';

export const apiV1Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', userManagementRouter);
apiV1Router.use('/courses', courseRouter);
apiV1Router.use('/catalog/courses', courseCatalogRouter);
