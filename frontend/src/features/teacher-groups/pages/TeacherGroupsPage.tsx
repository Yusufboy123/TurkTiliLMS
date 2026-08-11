import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth';
import { teacherGroupPaths } from '../teacher-groups.routes';
import {
  useCreateTeacherGroup,
  useDeleteTeacherGroup,
  useRestoreTeacherGroup,
  useTeacherGroups,
} from '../hooks/use-teacher-groups';
import type { GroupLevel } from '../types/teacher-groups.types';

const levels: GroupLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export default function TeacherGroupsPage() {
  const auth = useAuth();
  const [name, setName] = useState('');
  const [level, setLevel] = useState<GroupLevel>('A1');
  const [open, setOpen] = useState(false);
  const groups = useTeacherGroups({ page: 1, pageSize: 50, deleted: 'include' });
  const create = useCreateTeacherGroup();
  const remove = useDeleteTeacherGroup();
  const restore = useRestoreTeacherGroup();
  const canCreate = auth.status === 'authenticated' && auth.roles.includes('TEACHER');
  const canManage =
    auth.status === 'authenticated' &&
    (auth.roles.includes('TEACHER') || auth.roles.includes('ADMIN'));
  const canDelete = canManage && auth.permissions.includes('groups.delete');
  const canRestore = canManage && auth.permissions.includes('groups.restore');
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || auth.status !== 'authenticated') return;
    create.mutate(
      { name: name.trim(), level, teacherId: auth.user.id },
      {
        onSuccess: () => {
          setName('');
          setOpen(false);
        },
      },
    );
  };
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label-md text-brand-text">O‘qituvchi bo‘limi</p>
          <h1 className="type-heading-1 mt-2">Guruhlar</h1>
          <p className="mt-3 max-w-reading text-body-md text-text-secondary">
            Talabalarni guruhlarga biriktiring va ularning tarkibini boshqaring.
          </p>
        </div>
        {canCreate ? (
          <button
            className="rounded-md bg-action-primary px-4 py-2 text-button text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            Yangi guruh yaratish
          </button>
        ) : null}
      </header>
      {open && canCreate ? (
        <form
          className="mt-6 max-w-xl rounded-lg border border-border-decorative bg-surface p-5"
          onSubmit={submit}
        >
          <label className="block text-label-md" htmlFor="group-name">
            Guruh nomi
          </label>
          <input
            className="mt-2 w-full rounded-md border border-border-input px-3 py-2"
            id="group-name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          <label className="mt-4 block text-label-md" htmlFor="group-level">
            Daraja
          </label>
          <select
            className="mt-2 w-full rounded-md border border-border-input px-3 py-2"
            id="group-level"
            onChange={(event) => setLevel(event.target.value as GroupLevel)}
            value={level}
          >
            {levels.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <label className="mt-4 block text-label-md" htmlFor="group-teacher">
            O‘qituvchi
          </label>
          <input
            className="mt-2 w-full rounded-md border border-border-input bg-canvas px-3 py-2 text-text-secondary"
            id="group-teacher"
            readOnly
            value={auth.status === 'authenticated' ? auth.user.email : ''}
          />
          <button
            className="mt-5 rounded-md bg-action-primary px-4 py-2 text-button text-white disabled:opacity-50"
            disabled={create.isPending}
            type="submit"
          >
            {create.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </form>
      ) : null}
      {groups.isPending ? (
        <p className="mt-8" role="status">
          Yuklanmoqda…
        </p>
      ) : null}
      {groups.isError ? (
        <p className="mt-8 text-danger-text" role="alert">
          Guruhlarni yuklab bo‘lmadi.
        </p>
      ) : null}
      {groups.data && groups.data.items.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border-decorative bg-surface p-6 text-text-secondary">
          Hozircha guruhlar yo‘q.
        </p>
      ) : null}
      {groups.data && groups.data.items.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.data.items.map((group) => (
            <article
              className={`rounded-lg border border-border-decorative bg-surface p-5 ${group.deletedAt ? 'opacity-75' : ''}`}
              key={group.id}
            >
              <Link
                className="rounded-md text-text-primary no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                to={teacherGroupPaths.detail(group.id)}
              >
                <h2 className="type-heading-3 text-text-primary">{group.name}</h2>
              </Link>
              <p className="mt-2 text-body-sm text-text-secondary">Daraja: {group.level}</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Talabalar: {group.studentCount}
              </p>
              <p className="mt-1 text-body-sm text-text-secondary">
                O‘qituvchi: {group.teacher.displayName ?? group.teacher.email}
              </p>
              {group.deletedAt ? (
                <p className="mt-3 text-body-sm text-warning-text">Arxivlangan</p>
              ) : null}
              {canDelete || canRestore ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.deletedAt && canRestore ? (
                    <button
                      className="rounded-md border border-action-primary px-3 py-2 text-button text-action-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                      disabled={restore.isPending}
                      onClick={() => restore.mutate(group.id)}
                      type="button"
                    >
                      Tiklash
                    </button>
                  ) : !group.deletedAt && canDelete ? (
                    <button
                      className="rounded-md border border-danger-text px-3 py-2 text-button text-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm('Bu guruh arxivlansinmi?')) remove.mutate(group.id);
                      }}
                      type="button"
                    >
                      Guruhni o‘chirish
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
