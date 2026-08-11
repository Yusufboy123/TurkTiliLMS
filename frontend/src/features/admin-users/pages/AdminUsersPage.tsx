import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Select } from '../../../components';
import { useAuth } from '../../auth';
import type { RoleCode, UserStatus } from '../../auth/types/auth.types';
import { adminUsersPaths } from '../admin-users.routes';
import { useAdminRoles, useAdminUserStatus, useAdminUsers } from '../hooks/use-admin-users';

const roles: RoleCode[] = ['STUDENT', 'TEACHER', 'ADMIN'];
const statuses: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

const roleLabel: Record<RoleCode, string> = { ADMIN: 'Admin', TEACHER: 'O‘qituvchi', STUDENT: 'Talaba' };
const statusLabel: Record<UserStatus, string> = { ACTIVE: 'Faol', SUSPENDED: 'To‘xtatilgan', DEACTIVATED: 'Faolsiz', DELETED: 'O‘chirilgan' };

function displayName(user: { displayName: string | null; firstName: string | null; lastName: string | null; email: string }) {
  return user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('uz-Latn-UZ', { dateStyle: 'medium' }).format(new Date(value));
}

export default function AdminUsersPage() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const role = (searchParams.get('role') as RoleCode | null) ?? undefined;
  const status = (searchParams.get('status') as UserStatus | null) ?? undefined;
  const query = useMemo(() => ({ page: 1, pageSize: 100, ...(search ? { search } : {}), ...(role ? { role } : {}), ...(status ? { status } : {}) }), [role, search, status]);
  const users = useAdminUsers(query);

  const setFilter = (name: 'role' | 'status', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value); else next.delete(name);
    setSearchParams(next);
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label-md text-brand-text">Admin bo‘limi</p>
          <h1 className="type-heading-1 mt-2">Foydalanuvchilar</h1>
          <p className="mt-3 max-w-reading text-body-md text-text-secondary">Talaba, o‘qituvchi va admin hisoblarini boshqaring.</p>
        </div>
      </header>

      <section aria-label="Foydalanuvchi filtrlari" className="mt-8 grid gap-4 rounded-lg border border-border-decorative bg-surface p-5 md:grid-cols-3">
        <label className="grid gap-2 text-label-md" htmlFor="admin-user-search">Qidirish
          <input className="min-h-target rounded-md border border-border-control px-3 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-focus" id="admin-user-search" onChange={(event) => { const next = new URLSearchParams(searchParams); if (event.target.value) next.set('search', event.target.value); else next.delete('search'); setSearchParams(next); }} placeholder="Ism yoki email" value={search} />
        </label>
        <label className="grid gap-2 text-label-md" htmlFor="admin-user-role">Rol
          <Select id="admin-user-role" onChange={(event) => setFilter('role', event.target.value)} value={role ?? ''}>
            <option value="">Barcha rollar</option>{roles.map((item) => <option key={item} value={item}>{roleLabel[item]}</option>)}
          </Select>
        </label>
        <label className="grid gap-2 text-label-md" htmlFor="admin-user-status">Holat
          <Select id="admin-user-status" onChange={(event) => setFilter('status', event.target.value)} value={status ?? ''}>
            <option value="">Barcha holatlar</option>{statuses.map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
          </Select>
        </label>
      </section>

      {users.isPending ? <p className="mt-8" role="status">Yuklanmoqda…</p> : null}
      {users.isError ? <Card className="mt-8 border-danger-border bg-danger-bg" role="alert"><p className="text-danger-text">Foydalanuvchilarni yuklab bo‘lmadi.</p><Button className="mt-4" intent="secondary" onClick={() => void users.refetch()}>Qayta urinish</Button></Card> : null}
      {users.data && users.data.items.length === 0 ? <Card className="mt-8"><p className="text-body-md text-text-secondary">Natija topilmadi.</p></Card> : null}
      {users.data && users.data.items.length > 0 ? (
        <>
          <div className="mt-8 hidden overflow-x-auto rounded-lg border border-border-decorative bg-surface md:block">
            <table className="w-full min-w-[860px] text-left text-body-sm"><caption className="sr-only">Foydalanuvchilar ro‘yxati</caption><thead className="border-b border-border-decorative bg-subtle"><tr><th className="p-4" scope="col">Foydalanuvchi</th><th className="p-4" scope="col">Rol</th><th className="p-4" scope="col">Holat</th><th className="p-4" scope="col">Ro‘yxatdan o‘tgan</th><th className="p-4" scope="col"><span className="sr-only">Amal</span></th></tr></thead>
              <tbody className="divide-y divide-border-decorative">{users.data.items.map((user) => <UserRow key={user.id} user={user} currentUserId={auth.user?.id ?? ''} />)}</tbody>
            </table>
          </div>
          <div className="mt-8 grid gap-3 md:hidden">{users.data.items.map((user) => <UserCard key={user.id} user={user} currentUserId={auth.user?.id ?? ''} />)}</div>
        </>
      ) : null}
    </>
  );
}

function UserRow({ user, currentUserId }: { user: Parameters<typeof UserCard>[0]['user']; currentUserId: string }) {
  return <tr><td className="p-4"><p className="font-semibold">{displayName(user)}</p><p className="mt-1 break-all text-text-secondary">{user.email}</p></td><td className="p-4"><RoleControl user={user} currentUserId={currentUserId} /></td><td className="p-4"><StatusControl user={user} currentUserId={currentUserId} /></td><td className="p-4 text-text-secondary">{formatDate(user.createdAt)}</td><td className="p-4"><Link className="text-button text-action-secondary-text" to={adminUsersPaths.detail(user.id)}>Batafsil</Link></td></tr>;
}

function UserCard({ user, currentUserId }: { user: { id: string; email: string; firstName: string | null; lastName: string | null; displayName: string | null; status: UserStatus; createdAt: string; roles: RoleCode[] }; currentUserId: string }) {
  return <article className="rounded-lg border border-border-decorative bg-surface p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{displayName(user)}</h2><p className="mt-1 break-all text-body-sm text-text-secondary">{user.email}</p></div><Badge>{roleLabel[user.roles[0] ?? 'STUDENT']}</Badge></div><p className="mt-3 text-body-sm text-text-secondary">Ro‘yxatdan o‘tgan: {formatDate(user.createdAt)}</p><div className="mt-4 grid gap-3"><RoleControl user={user} currentUserId={currentUserId} /><StatusControl user={user} currentUserId={currentUserId} /></div><Link className="mt-4 inline-flex min-h-target items-center text-button text-action-secondary-text" to={adminUsersPaths.detail(user.id)}>Batafsil</Link></article>;
}

function RoleControl({ user, currentUserId }: { user: { id: string; roles: RoleCode[] }; currentUserId: string }) {
  const mutation = useAdminRoles(user.id);
  const current = user.roles[0] ?? 'STUDENT';
  return <label className="grid gap-1 text-caption text-text-secondary">Rol<Select aria-label={`${user.id} roli`} disabled={user.id === currentUserId || mutation.isPending} onChange={(event) => { const next = event.target.value as RoleCode; if (next !== current && window.confirm('Bu foydalanuvchi rolini o‘zgartirishni tasdiqlaysizmi?')) mutation.mutate([next]); }} value={current}>{roles.map((item) => <option key={item} value={item}>{roleLabel[item]}</option>)}</Select></label>;
}

function StatusControl({ user, currentUserId }: { user: { id: string; status: UserStatus }; currentUserId: string }) {
  const mutation = useAdminUserStatus(user.id);
  const current = user.status === 'DELETED' ? 'DEACTIVATED' : user.status;
  return <label className="grid gap-1 text-caption text-text-secondary">Holat<Select aria-label={`${user.id} holati`} disabled={user.id === currentUserId || mutation.isPending} onChange={(event) => { const next = event.target.value as Exclude<UserStatus, 'DELETED'>; if (next !== current && window.confirm('Bu foydalanuvchi holatini o‘zgartirishni tasdiqlaysizmi?')) mutation.mutate(next); }} value={current}>{statuses.map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}</Select></label>;
}
