import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { progressApi, toProgressClientError } from '../src/features/progress/api/progress.api';
import { apiClient } from '../src/lib/api-client';
import {
  courseProgressFixture,
  progressMutationFixture,
  progressSummaryFixture,
} from './progress-fixtures';

const originalAdapter = apiClient.defaults.adapter;
let requests: InternalAxiosRequestConfig[] = [];

function mockAdapter(responseData: unknown): AxiosAdapter {
  return async (config) => {
    requests.push(config);
    return {
      data: { success: true, message: 'OK', data: responseData },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
}

describe('progress API client', () => {
  beforeEach(() => {
    requests = [];
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('requests the student summary with the approved query parameter', async () => {
    apiClient.defaults.adapter = mockAdapter(progressSummaryFixture);

    await expect(progressApi.getSummary(5)).resolves.toEqual(progressSummaryFixture);
    expect(requests[0].url).toBe('/me/progress');
    expect(requests[0].params).toEqual({ activeLimit: 5 });
    expect(requests[0].method).toBe('get');
  });

  it('uses the enrollment-scoped detail endpoint', async () => {
    apiClient.defaults.adapter = mockAdapter(courseProgressFixture);

    await progressApi.getEnrollmentProgress(courseProgressFixture.enrollmentId);
    expect(requests[0].url).toBe(`/me/enrollments/${courseProgressFixture.enrollmentId}/progress`);
  });

  it('sends completion versions and Idempotency-Key to mutation endpoints', async () => {
    apiClient.defaults.adapter = mockAdapter(progressMutationFixture);

    await progressApi.completeBlock(
      courseProgressFixture.enrollmentId,
      courseProgressFixture.sections[0].lessons[0].blocks[0].id,
      { curriculumVersion: 3, expectedCompletionVersion: 4 },
      'test-idempotency-key-0001',
    );

    expect(requests[0].url).toContain('/blocks/');
    expect(requests[0].url).toContain('/complete');
    expect(requests[0].headers.get('Idempotency-Key')).toBe('test-idempotency-key-0001');
    expect(JSON.parse(String(requests[0].data))).toEqual({
      curriculumVersion: 3,
      expectedCompletionVersion: 4,
    });
  });

  it('uses only the approved student progress endpoints for every operation', async () => {
    apiClient.defaults.adapter = mockAdapter(progressMutationFixture);
    const enrollmentId = courseProgressFixture.enrollmentId;
    const lessonId = courseProgressFixture.sections[0].lessons[0].id;
    const blockId = courseProgressFixture.sections[0].lessons[0].blocks[0].id;
    const completionInput = { curriculumVersion: 3, expectedCompletionVersion: 4 };

    await progressApi.getCompletedCourses({ page: 1, pageSize: 20 });
    await progressApi.getResumeTarget(enrollmentId);
    await progressApi.reopenBlock(enrollmentId, blockId, completionInput, 'key-reopen-block-0001');
    await progressApi.completeLesson(
      enrollmentId,
      lessonId,
      completionInput,
      'key-complete-lesson-001',
    );
    await progressApi.reopenLesson(
      enrollmentId,
      lessonId,
      completionInput,
      'key-reopen-lesson-0001',
    );
    await progressApi.recordLastVisitedLesson(
      enrollmentId,
      { lessonId, curriculumVersion: 3 },
      'key-record-visit-00001',
    );

    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      'get /me/progress/completed-courses',
      `get /me/enrollments/${enrollmentId}/progress/resume`,
      `post /me/enrollments/${enrollmentId}/progress/blocks/${blockId}/reopen`,
      `post /me/enrollments/${enrollmentId}/progress/lessons/${lessonId}/complete`,
      `post /me/enrollments/${enrollmentId}/progress/lessons/${lessonId}/reopen`,
      `put /me/enrollments/${enrollmentId}/progress/last-visited-lesson`,
    ]);
  });

  it('maps unknown failures to safe Uzbek copy without leaking implementation details', () => {
    const error = toProgressClientError(new Error('C:\\secret\\stack.ts'));
    expect(error.message).toBe('Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.');
    expect(error.message).not.toContain('secret');
  });
});
