import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ConversionCard } from '../src/features/public-demo/components/FinalAssessment';
import { validateRegistrationForm } from '../src/features/auth/register/registration-form.model';
import { teacherStudentsApi } from '../src/features/teacher-students/api/teacher-students.api';
import { publicDemoMessages } from '../src/locales/uz-Latn/public-demo';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: { get: mocks.get, post: mocks.post } }));

describe('registration and student monitoring contracts', () => {
  it('validates password confirmation and policy', () => {
    const errors = validateRegistrationForm({
      firstName: 'Ali',
      lastName: 'Talaba',
      email: 'ali@example.com',
      password: 'short',
      passwordConfirmation: 'different',
    });
    expect(errors.password).toBeTruthy();
    expect(errors.passwordConfirmation).toBeTruthy();
  });

  it('keeps the demo registration CTA and teacher monitoring endpoint stable', async () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ConversionCard />
      </MemoryRouter>,
    );
    expect(markup).toContain('href="/register"');
    expect(markup).toContain('href="/login"');
    expect(publicDemoMessages.demo.conversionRegisterCta).toBe(
      'Ro‘yxatdan o‘tib kursni davom ettirish',
    );
    mocks.get.mockResolvedValueOnce({
      data: {
        data: {
          items: [],
          newStudentCount: 0,
          pagination: { page: 1, pageSize: 50, totalItems: 0, totalPages: 0 },
        },
      },
    });
    await teacherStudentsApi.list();
    expect(mocks.get).toHaveBeenCalledWith('/students', { params: { page: 1, pageSize: 50 } });
  });
});
