import { RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import {
  presentReportingDetail,
  presentReportingEnrollment,
  reportingCapabilities,
} from './progress-reporting.presenter.js';
import type { ProgressReportingRepository } from './progress-reporting.repository.js';
import type {
  AdminProgressPageDto,
  ProgressReportingActor,
  ProgressReportingQuery,
  ReportingAuditContext,
  TeacherCourseProgressPageDto,
  TeacherStudentProgressDetailDto,
} from './progress-reporting.types.js';

function accessDenied(): AppError {
  return new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
}

function courseScopeDenied(): AppError {
  return new AppError('Bu kurs sizga biriktirilmagan.', 403, 'COURSE_SCOPE_DENIED');
}

function progressScopeDenied(): AppError {
  return new AppError(
    'Bu o‘qish jarayonini ko‘rishga ruxsat yetarli emas.',
    403,
    'PROGRESS_SCOPE_DENIED',
  );
}

function courseNotFound(): AppError {
  return new AppError('Kurs topilmadi.', 404, 'COURSE_NOT_FOUND');
}

function enrollmentNotFound(): AppError {
  return new AppError('Enrollment topilmadi.', 404, 'ENROLLMENT_NOT_FOUND');
}

function assertTeacherReportingPolicy(actor: ProgressReportingActor): void {
  if (
    !actor.permissions.includes('progress.course.read') ||
    !actor.roles.some((role) => role === RoleCode.ADMIN || role === RoleCode.TEACHER)
  ) {
    throw accessDenied();
  }
}

function assertAdminReportingPolicy(actor: ProgressReportingActor): void {
  if (!actor.roles.includes(RoleCode.ADMIN) || !actor.permissions.includes('progress.read')) {
    throw accessDenied();
  }
}

export interface ProgressReportingUseCases {
  listTeacherCourse(
    courseId: string,
    query: ProgressReportingQuery,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<TeacherCourseProgressPageDto>;
  getTeacherEnrollment(
    courseId: string,
    enrollmentId: string,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<TeacherStudentProgressDetailDto>;
  listAdmin(
    query: ProgressReportingQuery,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<AdminProgressPageDto>;
  getAdminEnrollment(
    enrollmentId: string,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<TeacherStudentProgressDetailDto>;
}

export class ProgressReportingService implements ProgressReportingUseCases {
  constructor(private readonly repository: ProgressReportingRepository) {}

  async listTeacherCourse(
    courseId: string,
    query: ProgressReportingQuery,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<TeacherCourseProgressPageDto> {
    assertTeacherReportingPolicy(actor);
    const course = await this.repository.findCourse(courseId);
    if (!course) throw courseNotFound();
    if (!actor.roles.includes(RoleCode.ADMIN) && course.teacherId !== actor.userId) {
      throw courseScopeDenied();
    }
    const [listing, statistics] = await Promise.all([
      this.repository.listEnrollments(query, courseId),
      this.repository.courseStatistics(courseId),
    ]);
    await this.repository.recordAccess(
      'progress_reporting.course_listed',
      'course',
      courseId,
      audit,
    );
    return {
      course: { id: course.id, title: course.title, slug: course.slug },
      curriculumVersion: course.curriculumVersion,
      activeEnrollmentCount: statistics.active,
      suspendedEnrollmentCount: statistics.suspended,
      completedEnrollmentCount: statistics.completed,
      cancelledEnrollmentCount: statistics.cancelled,
      averageProgressPercentage: statistics.averagePercentage,
      items: listing.items.map(presentReportingEnrollment),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: listing.total,
        totalPages: Math.ceil(listing.total / query.pageSize),
      },
      capabilities: reportingCapabilities,
    };
  }

  async getTeacherEnrollment(
    courseId: string,
    enrollmentId: string,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<TeacherStudentProgressDetailDto> {
    assertTeacherReportingPolicy(actor);
    const course = await this.repository.findCourse(courseId);
    if (!course) throw courseNotFound();
    if (!actor.roles.includes(RoleCode.ADMIN) && course.teacherId !== actor.userId) {
      throw courseScopeDenied();
    }
    const record = await this.repository.findDetailedEnrollment(enrollmentId);
    if (!record || record.enrollment.course.id !== courseId) throw enrollmentNotFound();
    await this.repository.recordAccess(
      'progress_reporting.course_enrollment_viewed',
      'course_enrollment',
      enrollmentId,
      audit,
    );
    return {
      student: record.student,
      progress: presentReportingDetail(record, new Date()),
      capabilities: reportingCapabilities,
    };
  }

  async listAdmin(
    query: ProgressReportingQuery,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<AdminProgressPageDto> {
    assertAdminReportingPolicy(actor);
    const [listing, statistics] = await Promise.all([
      this.repository.listEnrollments(query),
      this.repository.adminStatistics(query),
    ]);
    await this.repository.recordAccess('progress_reporting.admin_listed', 'progress', null, audit);
    return {
      generatedAt: new Date().toISOString(),
      totalEnrollments: statistics.total,
      activeLearners: statistics.active,
      completedEnrollments: statistics.completed,
      averageProgressPercentage: statistics.averagePercentage,
      items: listing.items.map(presentReportingEnrollment),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: listing.total,
        totalPages: Math.ceil(listing.total / query.pageSize),
      },
      capabilities: reportingCapabilities,
    };
  }

  async getAdminEnrollment(
    enrollmentId: string,
    actor: ProgressReportingActor,
    audit: ReportingAuditContext,
  ): Promise<TeacherStudentProgressDetailDto> {
    assertAdminReportingPolicy(actor);
    const record = await this.repository.findDetailedEnrollment(enrollmentId);
    if (!record) throw enrollmentNotFound();
    if (!actor.permissions.includes('progress.read')) throw progressScopeDenied();
    await this.repository.recordAccess(
      'progress_reporting.admin_enrollment_viewed',
      'course_enrollment',
      enrollmentId,
      audit,
    );
    return {
      student: record.student,
      progress: presentReportingDetail(record, new Date()),
      capabilities: reportingCapabilities,
    };
  }
}
