import { Router } from 'express';
import { adminDashboardRouter } from '../modules/admin-dashboard/admin-dashboard.routes.js';
import { adminActivityRouter } from '../modules/admin-activity/admin-activity.routes.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { certificateEligibilityRouter } from '../modules/certificate-eligibility/certificate-eligibility.routes.js';
import { certificateIssuanceRouter } from '../modules/certificate-issuance/certificate-issuance.routes.js';
import { courseCatalogRouter, courseRouter } from '../modules/courses/course.routes.js';
import {
  courseEnrollmentRouter,
  enrollmentManagementRouter,
  myEnrollmentRouter,
} from '../modules/course-enrollments/course-enrollment.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { groupsRouter } from '../modules/groups/groups.routes.js';
import { studentMonitoringRouter } from '../modules/student-monitoring/student-monitoring.routes.js';
import { studentProfileRouter } from '../modules/student-profile/student-profile.routes.js';
import {
  lessonContentBlockCatalogRouter,
  lessonContentBlockRouter,
} from '../modules/lesson-content-blocks/lesson-content-block.routes.js';
import {
  lessonCatalogRouter,
  lessonRouter,
  sectionRouter,
} from '../modules/lessons/lesson-management.routes.js';
import { lessonLearningRouter } from '../modules/lesson-learning/lesson-learning.routes.js';
import { mediaRouter } from '../modules/media/media.routes.js';
import { progressReportingRouter } from '../modules/progress-reporting/progress-reporting.routes.js';
import { progressTrackingRouter } from '../modules/progress-tracking/progress-tracking.routes.js';
import { stepUpAuthenticationRouter } from '../modules/step-up-authentication/step-up-authentication.routes.js';
import { userManagementRouter } from '../modules/users/user-management.routes.js';
import { notificationRouter } from '../modules/notifications/notification.routes.js';
import { studentProductivityRouter } from '../modules/student-productivity/student-productivity.routes.js';

export const apiV1Router = Router();

apiV1Router.use('/health', healthRouter);
apiV1Router.use(adminDashboardRouter);
apiV1Router.use(adminActivityRouter);
apiV1Router.use(notificationRouter);
apiV1Router.use(studentProductivityRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/auth/step-up', stepUpAuthenticationRouter);
apiV1Router.use('/users', userManagementRouter);
apiV1Router.use('/groups', groupsRouter);
apiV1Router.use('/students', studentMonitoringRouter);
apiV1Router.use(studentProfileRouter);
apiV1Router.use('/media', mediaRouter);
apiV1Router.use(certificateEligibilityRouter);
apiV1Router.use(certificateIssuanceRouter);
apiV1Router.use(progressTrackingRouter);
apiV1Router.use(progressReportingRouter);
apiV1Router.use(lessonLearningRouter);
apiV1Router.use('/courses/:courseId/enrollments', courseEnrollmentRouter);
apiV1Router.use('/me/enrollments', myEnrollmentRouter);
apiV1Router.use('/enrollments', enrollmentManagementRouter);
apiV1Router.use('/courses/:courseId/sections', sectionRouter);
apiV1Router.use('/courses/:courseId/lessons/:lessonId/blocks', lessonContentBlockRouter);
apiV1Router.use('/courses/:courseId/lessons', lessonRouter);
apiV1Router.use('/courses', courseRouter);
apiV1Router.use('/catalog/courses', lessonContentBlockCatalogRouter);
apiV1Router.use('/catalog/courses', lessonCatalogRouter);
apiV1Router.use('/catalog/courses', courseCatalogRouter);
