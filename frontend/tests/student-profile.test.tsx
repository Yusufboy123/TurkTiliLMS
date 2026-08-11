import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { studentProfileApi } from '../src/features/student-profile/api/student-profile.api';
import StudentOnboardingPage from '../src/features/student-profile/pages/StudentOnboardingPage';
import { studentProfileQueryKeys } from '../src/features/student-profile/hooks/student-profile-query-keys';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: mocks }));

describe('student onboarding', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the owner-only profile endpoints', async () => {
    mocks.get.mockResolvedValueOnce({ data: { success: true, data: null } });
    mocks.put.mockResolvedValueOnce({ data: { success: true, data: { currentLevel: 'A1' } } });
    await studentProfileApi.get();
    await studentProfileApi.update({
      currentLevel: 'A1',
      learningGoal: 'STUDY',
      ageRange: null,
      gender: null,
      weeklyStudyBand: null,
      preferredSkillFocus: null,
    });
    expect(mocks.get).toHaveBeenCalledWith('/me/student-profile');
    expect(mocks.put).toHaveBeenCalledWith('/me/student-profile', expect.objectContaining({ currentLevel: 'A1' }));
  });

  it('renders required fields and optional skip affordance on a narrow layout', () => {
    const client = new QueryClient();
    client.setQueryData(studentProfileQueryKeys.current(), null);
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/onboarding']}>
          <StudentOnboardingPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(markup).toContain('Turk tili darajasi');
    expect(markup).toContain('O‘quv maqsadi');
    expect(markup).toContain('Ixtiyoriylarini keyinroq');
    expect(markup).toContain('flex-wrap');
  });
});
