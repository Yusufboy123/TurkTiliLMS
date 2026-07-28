import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { certificateEligibilityApi } from '../src/features/certificate-eligibility/api/certificate-eligibility.api';
import { certificateEligibilityErrorMessage } from '../src/features/certificate-eligibility/api/certificate-eligibility.error';
import { CertificateEligibilityPanel } from '../src/features/certificate-eligibility/components';
import { certificateEligibilityQueryKeys } from '../src/features/certificate-eligibility/hooks/certificate-eligibility-query-keys';
import type {
  CertificateEligibility,
  CertificateStatus,
} from '../src/features/certificate-eligibility/types/certificate-eligibility.types';
import { apiClient } from '../src/lib/api-client';

const enrollmentId = '019d0000-0000-7000-8000-000000000501';
const courseId = '019d0000-0000-7000-8000-000000000502';
const course = { id: courseId, title: 'Turk tili A1', slug: 'turk-tili-a1' };
const capabilities = {
  canReadEligibility: true,
  canReadCertificateStatus: true,
  canIssueCertificate: false as const,
  canRevokeCertificate: false as const,
};
const eligibility: CertificateEligibility = {
  enrollmentId,
  course,
  completion: {
    status: 'COMPLETED',
    completedAt: '2026-07-28T10:00:00.000Z',
    completionCurriculumVersion: 2,
    completionVersion: 3,
    completedLessons: 2,
    totalEligibleLessons: 2,
    percentage: 100,
  },
  eligibility: {
    id: '019d0000-0000-7000-8000-000000000503',
    status: 'ELIGIBLE',
    policyCode: 'COURSE_COMPLETION_ONLY',
    policyVersion: 1,
    evaluationVersion: 1,
    evaluatedAt: '2026-07-28T10:00:01.000Z',
    reasonCodes: [],
  },
  capabilities,
};
const status: CertificateStatus = {
  enrollmentId,
  course,
  status: 'NOT_ISSUED',
  certificate: null,
  capabilities,
};

const originalAdapter = apiClient.defaults.adapter;
let requests: InternalAxiosRequestConfig[] = [];

function mockAdapter(data: unknown): AxiosAdapter {
  return async (config) => {
    requests.push(config);
    return {
      data: { success: true, message: 'OK', data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
}

describe('certificate eligibility API and query isolation', () => {
  beforeEach(() => {
    requests = [];
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('uses exactly the four approved read-only endpoints', async () => {
    apiClient.defaults.adapter = mockAdapter(eligibility);
    await certificateEligibilityApi.getEligibility(enrollmentId, { kind: 'self' });
    await certificateEligibilityApi.getCertificateStatus(enrollmentId, { kind: 'self' });
    await certificateEligibilityApi.getEligibility(enrollmentId, { kind: 'course', courseId });
    await certificateEligibilityApi.getCertificateStatus(enrollmentId, {
      kind: 'course',
      courseId,
    });
    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `get /me/enrollments/${enrollmentId}/certificate-eligibility`,
      `get /me/enrollments/${enrollmentId}/certificate-status`,
      `get /courses/${courseId}/enrollments/${enrollmentId}/certificate-eligibility`,
      `get /courses/${courseId}/enrollments/${enrollmentId}/certificate-status`,
    ]);
  });

  it('separates self and course-scoped cache entries', () => {
    expect(certificateEligibilityQueryKeys.eligibility({ kind: 'self' }, enrollmentId)).not.toEqual(
      certificateEligibilityQueryKeys.eligibility({ kind: 'course', courseId }, enrollmentId),
    );
    expect(certificateEligibilityQueryKeys.eligibility({ kind: 'self' }, enrollmentId)).not.toEqual(
      certificateEligibilityQueryKeys.certificateStatus({ kind: 'self' }, enrollmentId),
    );
  });
});

describe('CertificateEligibilityPanel', () => {
  it('renders authoritative eligible and NOT_ISSUED read-only states accessibly', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const scope = { kind: 'self' as const };
    client.setQueryData(
      certificateEligibilityQueryKeys.eligibility(scope, enrollmentId),
      eligibility,
    );
    client.setQueryData(
      certificateEligibilityQueryKeys.certificateStatus(scope, enrollmentId),
      status,
    );
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <CertificateEligibilityPanel enrollmentId={enrollmentId} scope={scope} />
      </QueryClientProvider>,
    );
    expect(markup).toContain('Sertifikat olishga muvofiq');
    expect(markup).toContain('Sertifikat hali berilmagan');
    expect(markup).toContain('100%');
    expect(markup).not.toContain('<button');
  });

  it('renders NOT_COMPLETED without inferring eligibility locally', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    const scope = { kind: 'course' as const, courseId };
    client.setQueryData(certificateEligibilityQueryKeys.eligibility(scope, enrollmentId), {
      ...eligibility,
      completion: {
        ...eligibility.completion,
        status: 'NOT_COMPLETED',
        completedAt: null,
        completionCurriculumVersion: null,
        completionVersion: null,
        completedLessons: 1,
        percentage: 50,
      },
      eligibility: {
        id: null,
        status: 'NOT_COMPLETED',
        policyCode: null,
        policyVersion: null,
        evaluationVersion: null,
        evaluatedAt: null,
        reasonCodes: ['COURSE_NOT_COMPLETED'],
      },
    } satisfies CertificateEligibility);
    client.setQueryData(
      certificateEligibilityQueryKeys.certificateStatus(scope, enrollmentId),
      status,
    );
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <CertificateEligibilityPanel enrollmentId={enrollmentId} scope={scope} />
      </QueryClientProvider>,
    );
    expect(markup).toContain('Kurs hali yakunlanmagan');
    expect(markup).toContain('50%');
  });

  it('renders an accessible loading state while read contracts are pending', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <CertificateEligibilityPanel enrollmentId={enrollmentId} scope={{ kind: 'self' }} />
      </QueryClientProvider>,
    );
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
  });

  it('renders permission denial accessibly without leaking transport details', () => {
    const denied = new AxiosError('private stack', 'ERR_BAD_REQUEST', undefined, undefined, {
      data: { success: false, code: 'ACCESS_DENIED', message: 'denied' },
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    });
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, retryOnMount: false, refetchOnMount: false },
      },
    });
    const scope = { kind: 'self' as const };
    client
      .getQueryCache()
      .build(client, {
        queryKey: certificateEligibilityQueryKeys.eligibility(scope, enrollmentId),
        queryFn: async () => eligibility,
      })
      .setState({ status: 'error', error: denied, fetchStatus: 'idle' });
    client.setQueryData(
      certificateEligibilityQueryKeys.certificateStatus(scope, enrollmentId),
      status,
    );

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <CertificateEligibilityPanel enrollmentId={enrollmentId} scope={scope} />
      </QueryClientProvider>,
    );

    expect(certificateEligibilityErrorMessage(denied)).toContain('ruxsat yetarli emas');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Qayta urinish');
    expect(markup).not.toContain('private stack');
  });
});
