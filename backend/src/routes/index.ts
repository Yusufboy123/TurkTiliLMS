import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { courseCatalogRouter, courseRouter } from '../modules/courses/course.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import {
  lessonContentBlockCatalogRouter,
  lessonContentBlockRouter,
} from '../modules/lesson-content-blocks/lesson-content-block.routes.js';
import {
  lessonCatalogRouter,
  lessonRouter,
  sectionRouter,
} from '../modules/lessons/lesson-management.routes.js';
import { mediaRouter } from '../modules/media/media.routes.js';
import { userManagementRouter } from '../modules/users/user-management.routes.js';

export const apiV1Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', userManagementRouter);
apiV1Router.use('/media', mediaRouter);
apiV1Router.use('/courses/:courseId/sections', sectionRouter);
apiV1Router.use('/courses/:courseId/lessons/:lessonId/blocks', lessonContentBlockRouter);
apiV1Router.use('/courses/:courseId/lessons', lessonRouter);
apiV1Router.use('/courses', courseRouter);
apiV1Router.use('/catalog/courses', lessonContentBlockCatalogRouter);
apiV1Router.use('/catalog/courses', lessonCatalogRouter);
apiV1Router.use('/catalog/courses', courseCatalogRouter);
