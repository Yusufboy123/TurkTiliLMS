import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminActivityPage from '../src/features/admin-activity/pages/AdminActivityPage';
import type { AdminActivityPage as ActivityPage } from '../src/features/admin-activity/admin-activity.types';

vi.mock('../src/features/auth', () => ({
  useAuth: () => ({ status: 'authenticated', roles: ['ADMIN'], permissions: ['audit.read'] }),
}));

const data: ActivityPage = {
  items: [{ id: 'log-1', actor: { id: 'admin-1', name: 'Yusuf', email: 'yusuf@example.test' }, action: 'users.deleted', entityType: 'user', entityId: 'user-1', summary: 'users.deleted — Student', createdAt: '2026-08-11T00:00:00.000Z' }],
  pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
};

function render(queryData?: ActivityPage) {
  const client = new QueryClient();
  if (queryData) client.setQueryData(['admin-activity', { page: 1, pageSize: 20 }], queryData);
  return renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter><AdminActivityPage /></MemoryRouter></QueryClientProvider>);
}

describe('admin activity page', () => {
  it('renders readable activity rows and responsive controls', () => {
    const markup = render(data);
    expect(markup).toContain('Faoliyat tarixi');
    expect(markup).toContain('Yusuf');
    expect(markup).toContain('Foydalanuvchi o‘chirildi');
    expect(markup).toContain('flex-wrap');
    expect(markup).toContain('break-words');
  });

  it('renders loading and empty states', () => {
    expect(render()).toContain('Yuklanmoqda');
    expect(render({ ...data, items: [] })).toContain('Faoliyat yozuvlari topilmadi');
  });
});
