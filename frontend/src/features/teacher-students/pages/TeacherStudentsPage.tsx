import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeacherStudents } from '../hooks/use-teacher-students';
import { teacherStudentPaths } from '../teacher-students.routes';

function studentName(student: {
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
function date(value: string) {
  return new Intl.DateTimeFormat('uz-Latn-UZ', { dateStyle: 'medium' }).format(new Date(value));
}

export default function TeacherStudentsPage() {
  const [search, setSearch] = useState('');
  const students = useTeacherStudents(search);
  return (
    <>
      <header>
        <p className="text-label-md text-brand-text">O‘qituvchi bo‘limi</p>
        <h1 className="type-heading-1 mt-2">Talabalar</h1>
        <p className="mt-3 max-w-reading text-body-md text-text-secondary">
          Sizga biriktirilgan kurslarda o‘qiyotgan talabalar jarayonini kuzating.
        </p>
      </header>
      <section aria-label="Talabalar ko‘rsatkichlari" className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border-decorative bg-surface p-5">
          <p className="text-label-md text-text-secondary">Jami talabalar</p>
          <p className="mt-2 text-3xl font-semibold">
            {students.data?.pagination.totalItems ?? '—'}
          </p>
        </div>
        <div className="rounded-lg border border-border-decorative bg-surface p-5">
          <p className="text-label-md text-text-secondary">Yangi talabalar (7 kun)</p>
          <p className="mt-2 text-3xl font-semibold">{students.data?.newStudentCount ?? '—'}</p>
        </div>
      </section>
      <label className="sr-only" htmlFor="teacher-student-search">
        Talaba qidirish
      </label>
      <input
        className="mt-8 w-full max-w-xl rounded-md border border-border-input px-3 py-2"
        id="teacher-student-search"
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Ism yoki email orqali qidiring"
        value={search}
      />
      {students.isPending ? (
        <p className="mt-8" role="status">
          Yuklanmoqda…
        </p>
      ) : null}
      {students.isError ? (
        <p className="mt-8 text-danger-text" role="alert">
          Talabalarni yuklab bo‘lmadi.
        </p>
      ) : null}
      {students.data && students.data.items.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border-decorative bg-surface p-6 text-text-secondary">
          Sizga ko‘rsatiladigan talabalar hozircha yo‘q.
        </p>
      ) : null}
      {students.data && students.data.items.length > 0 ? (
        <>
          <div className="mt-8 hidden overflow-x-auto rounded-lg border border-border-decorative bg-surface md:block">
            <table className="w-full min-w-[760px] text-left text-body-sm">
            <caption className="sr-only">Talabalar monitoringi</caption>
            <thead className="border-b border-border-decorative bg-subtle">
              <tr>
                <th className="p-4 font-semibold" scope="col">
                  Talaba
                </th>
                <th className="p-4 font-semibold" scope="col">
                  Ro‘yxatdan o‘tgan
                </th>
                <th className="p-4 font-semibold" scope="col">
                  Kurs
                </th>
                <th className="p-4 font-semibold" scope="col">
                  Progress
                </th>
                <th className="p-4 font-semibold" scope="col">
                  So‘nggi faollik
                </th>
                <th className="p-4 font-semibold" scope="col">
                  <span className="sr-only">Amal</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-decorative">
              {students.data.items.map((student) => (
                <tr key={student.id}>
                  <td className="p-4">
                    <p className="font-semibold">{studentName(student)}</p>
                    <p className="mt-1 text-text-secondary">{student.email}</p>
                  </td>
                  <td className="p-4 text-text-secondary">{date(student.registeredAt)}</td>
                  <td className="p-4 text-text-secondary">{student.currentCourse?.title ?? '—'}</td>
                  <td className="p-4">{student.overallPercentage}%</td>
                  <td className="p-4 text-text-secondary">
                    {student.lastActivityAt ? date(student.lastActivityAt) : '—'}
                  </td>
                  <td className="p-4">
                    <Link
                      className="text-button text-action-secondary-text"
                      to={teacherStudentPaths.detail(student.id)}
                    >
                      Batafsil
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <div className="mt-8 grid gap-3 md:hidden" aria-label="Talabalar monitoringi">
            {students.data.items.map((student) => (
              <article
                className="rounded-lg border border-border-decorative bg-surface p-4"
                key={student.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold break-words">{studentName(student)}</h2>
                    <p className="mt-1 break-words text-body-sm text-text-secondary">
                      {student.email}
                    </p>
                  </div>
                  <p className="shrink-0 text-heading-4 text-action-primary-bg">
                    {student.overallPercentage}%
                  </p>
                </div>
                <dl className="mt-4 grid gap-2 text-body-sm text-text-secondary">
                  <div className="flex justify-between gap-3">
                    <dt>Ro‘yxatdan o‘tgan</dt>
                    <dd className="text-right">{date(student.registeredAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Kurs</dt>
                    <dd className="text-right">{student.currentCourse?.title ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>So‘nggi faollik</dt>
                    <dd className="text-right">
                      {student.lastActivityAt ? date(student.lastActivityAt) : '—'}
                    </dd>
                  </div>
                </dl>
                <Link
                  className="mt-4 inline-block text-button text-action-secondary-text"
                  to={teacherStudentPaths.detail(student.id)}
                >
                  Batafsil
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
