import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { teacherGroupPaths } from '../teacher-groups.routes';
import {
  useAddGroupStudent,
  useRemoveGroupStudent,
  useSearchGroupStudents,
  useTeacherGroup,
} from '../hooks/use-teacher-groups';

function label(student: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  return (
    student.displayName ||
    [student.firstName, student.lastName].filter(Boolean).join(' ') ||
    student.email
  );
}
export default function TeacherGroupDetailPage() {
  const { groupId = '' } = useParams();
  const group = useTeacherGroup(groupId);
  const [search, setSearch] = useState('');
  const results = useSearchGroupStudents(groupId, search);
  const add = useAddGroupStudent(groupId);
  const remove = useRemoveGroupStudent(groupId);
  if (group.isPending) return <p role="status">Yuklanmoqda…</p>;
  if (group.isError || !group.data)
    return (
      <p className="text-danger-text" role="alert">
        Guruh topilmadi yoki uni ko‘rish mumkin emas.
      </p>
    );
  const members = new Set((group.data.students ?? []).map((student) => student.id));
  return (
    <>
      <Link className="text-button text-action-secondary-text" to={teacherGroupPaths.list}>
        ← Guruhlarga qaytish
      </Link>
      <header className="mt-5">
        <p className="text-label-md text-brand-text">Guruh tafsilotlari</p>
        <h1 className="type-heading-1 mt-2">{group.data.name}</h1>
        <p className="mt-2 text-body-md text-text-secondary">
          Daraja: {group.data.level} · O‘qituvchi: {label(group.data.teacher)}
        </p>
      </header>
      <section aria-labelledby="student-search-heading" className="mt-8">
        <h2 className="type-heading-2" id="student-search-heading">
          Talaba qo‘shish
        </h2>
        <label className="sr-only" htmlFor="student-search">
          Ism yoki email orqali qidiring
        </label>
        <input
          className="mt-3 w-full max-w-xl rounded-md border border-border-input px-3 py-2"
          id="student-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Ism yoki email orqali qidiring"
          value={search}
        />
        {results.data?.length ? (
          <ul className="mt-3 max-w-xl divide-y divide-border-decorative rounded-lg border border-border-decorative bg-surface">
            {results.data.map((student) => (
              <li className="flex items-center justify-between gap-3 p-3" key={student.id}>
                <span>
                  <strong>{label(student)}</strong>
                  <span className="ml-2 text-body-sm text-text-secondary">{student.email}</span>
                </span>
                <button
                  className="rounded-md border border-action-primary px-3 py-1 text-button text-action-primary-text disabled:opacity-50"
                  disabled={members.has(student.id) || add.isPending}
                  onClick={() => add.mutate(student.id)}
                  type="button"
                >
                  {members.has(student.id) ? 'Qo‘shilgan' : 'Guruhga qo‘shish'}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section aria-labelledby="members-heading" className="mt-10">
        <h2 className="type-heading-2" id="members-heading">
          Guruh talabalari ({group.data.studentCount})
        </h2>
        {group.data.students?.length ? (
          <ul className="mt-3 max-w-xl divide-y divide-border-decorative rounded-lg border border-border-decorative bg-surface">
            {group.data.students.map((student) => (
              <li className="flex items-center justify-between gap-3 p-3" key={student.id}>
                <span>
                  <strong>{label(student)}</strong>
                  <span className="ml-2 text-body-sm text-text-secondary">{student.email}</span>
                </span>
                <button
                  className="rounded-md border border-danger-text px-3 py-1 text-button text-danger-text disabled:opacity-50"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(student.id)}
                  type="button"
                >
                  Guruhdan chiqarish
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-text-secondary">Guruhda hali talaba yo‘q.</p>
        )}
      </section>
    </>
  );
}
