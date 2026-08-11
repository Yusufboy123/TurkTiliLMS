import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components';
import { teacherStudentsApi } from '../api/teacher-students.api';
import { teacherStudentPaths } from '../teacher-students.routes';
import { useTeacherStudent } from '../hooks/use-teacher-students';

function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('uz-Latn-UZ', { dateStyle: 'medium' }).format(new Date(value))
    : '—';
}
export default function TeacherStudentDetailPage() {
  const { studentId = '' } = useParams();
  const student = useTeacherStudent(studentId);
  const client = useQueryClient();
  const access = useMutation({ mutationFn: (input: { enrollmentId: string; months?: number; date?: string }) => teacherStudentsApi.updateAccess(input.enrollmentId, input.months ? { durationMonths: input.months } : { accessExpiresAt: input.date }), onSuccess: () => { void client.invalidateQueries({ queryKey: ['teacher-students', 'detail', studentId] }); } });
  const [customExpiry, setCustomExpiry] = useState('');
  if (student.isPending) return <p role="status">Yuklanmoqda…</p>;
  if (student.isError || !student.data)
    return (
      <p className="text-danger-text" role="alert">
        Talaba topilmadi yoki jarayonni ko‘rishga ruxsat yo‘q.
      </p>
    );
  const name =
    student.data.student.displayName ||
    [student.data.student.firstName, student.data.student.lastName].filter(Boolean).join(' ') ||
    student.data.student.email;
  return (
    <>
      <Link className="text-button text-action-secondary-text" to={teacherStudentPaths.list}>
        ← Talabalarga qaytish
      </Link>
      <header className="mt-5">
        <p className="text-label-md text-brand-text">Talaba tafsilotlari</p>
        <h1 className="type-heading-1 mt-2">{name}</h1>
        <p className="mt-2 text-body-md text-text-secondary">
          {student.data.student.email} · Ro‘yxatdan o‘tgan:{' '}
          {date(student.data.student.registeredAt)}
        </p>
      </header>
      <section aria-label="Umumiy progress" className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border-decorative bg-surface p-5">
          <p className="text-label-md text-text-secondary">Umumiy progress</p>
          <p className="mt-2 text-3xl font-semibold">{student.data.overallPercentage}%</p>
        </div>
        <div className="rounded-lg border border-border-decorative bg-surface p-5">
          <p className="text-label-md text-text-secondary">Tugallangan kurslar</p>
          <p className="mt-2 text-3xl font-semibold">{student.data.completedCourses}</p>
        </div>
      </section>
      <section aria-labelledby="student-courses-heading" className="mt-10">
        <h2 className="type-heading-2" id="student-courses-heading">
          Kurslar ({student.data.courses.length})
        </h2>
        <div className="mt-4 grid gap-4">
          {student.data.courses.map((course) => (
            <article
              className="rounded-lg border border-border-decorative bg-surface p-5"
              key={course.enrollmentId}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="type-heading-3">{course.course.title}</h3>
                  <p className="mt-1 text-body-sm text-text-secondary">
                    Holat: {course.enrollmentStatus}
                  </p>
                </div>
                <p className="text-heading-3 text-action-primary-bg">{course.percentage}%</p>
              </div>
              <div className="mt-4 grid gap-2 text-body-sm text-text-secondary sm:grid-cols-2">
                <p>
                  Tugallangan darslar: {course.completedLessons}/{course.totalEligibleLessons}
                </p>
                <p>So‘nggi faollik: {date(course.lastActivityAt)}</p>
                <p>
                  Joriy dars:{' '}
                  {course.currentLesson
                    ? `${course.currentLesson.sectionTitle} / ${course.currentLesson.title}`
                    : '—'}
                </p>
                <p>Sertifikat: {course.certificateStatus ?? 'Mavjud emas'}</p>
                <p>Kirish muddati: {date(course.accessExpiresAt)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2" aria-label="Kursga kirish muddatini uzaytirish">
                <span className="self-center text-caption text-text-secondary">Uzaytirish:</span>
                {[1, 3, 6, 12].map((months) => <Button key={months} intent="secondary" disabled={access.isPending} onClick={() => access.mutate({ enrollmentId: course.enrollmentId, months })}>{months} oy</Button>)}<input aria-label="Maxsus tugash sanasi" className="min-h-target rounded-md border border-border-decorative px-3" type="date" value={customExpiry} onChange={(event) => setCustomExpiry(event.target.value)} /><Button intent="secondary" disabled={!customExpiry || access.isPending} onClick={() => access.mutate({ enrollmentId: course.enrollmentId, date: new Date(`${customExpiry}T23:59:59.000Z`).toISOString() })}>Sanani saqlash</Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
