import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField, Input, Select } from '../../../components';
import { useAuth } from '../../auth';
import type { RoleCode, UserStatus } from '../../auth/types/auth.types';
import { adminUsersPaths } from '../admin-users.routes';
import {
  useAdminCertificateEligibility,
  useAdminCertificateStatus,
  useAdminCourses,
  useAdminEnrollStudent,
  useAdminRoles,
  useAdminUserDelete,
  useAdminUserRestore,
  useAdminStudent,
  useAdminUser,
  useAdminUserStatus,
  useAssignAdminCourseTeacher,
  useAdminEnrollmentStatus,
  useAdminEnrollmentAccess,
  useIssueAdminCertificate,
  useRevokeAdminCertificate,
} from '../hooks/use-admin-users';
import type { AdminStudentCourse } from '../types/admin-users.types';

const roleLabel: Record<RoleCode, string> = { ADMIN: 'Admin', TEACHER: 'O‘qituvchi', STUDENT: 'Talaba' };
const statusLabel: Record<UserStatus, string> = { ACTIVE: 'Faol', SUSPENDED: 'To‘xtatilgan', DEACTIVATED: 'Faolsiz', DELETED: 'O‘chirilgan' };
const statuses: Array<Exclude<UserStatus, 'DELETED'>> = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'];

function nameOf(user: { displayName: string | null; firstName: string | null; lastName: string | null; email: string }) {
  return user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
}

export default function AdminUserDetailPage() {
  const { userId = '' } = useParams();
  const auth = useAuth();
  const user = useAdminUser(userId);
  const isStudent = user.data?.roles.includes('STUDENT') ?? false;
  const isTeacher = user.data?.roles.includes('TEACHER') ?? false;
  const student = useAdminStudent(userId, isStudent);
  const courses = useAdminCourses();
  const roleMutation = useAdminRoles(userId);
  const statusMutation = useAdminUserStatus(userId);
  const deleteMutation = useAdminUserDelete();
  const restoreMutation = useAdminUserRestore();
  const assign = useAssignAdminCourseTeacher();
  const enroll = useAdminEnrollStudent();
  const enrollmentStatus = useAdminEnrollmentStatus();
  const enrollmentAccess = useAdminEnrollmentAccess();
  const [newCourseId, setNewCourseId] = useState('');

  if (user.isPending) return <p role="status">Yuklanmoqda…</p>;
  if (user.isError || !user.data) return <p className="text-danger-text" role="alert">Foydalanuvchi topilmadi.</p>;

  const currentRole = user.data.roles[0] ?? 'STUDENT';
  const assignedCourses = courses.data?.items.filter((course) => course.teacher?.id === userId) ?? [];
  const enrolledCourseIds = new Set(student.data?.courses.map((item) => item.course.id) ?? []);
  const availableCourses = courses.data?.items.filter((course) => !enrolledCourseIds.has(course.id)) ?? [];
  const canAssignTeacher = auth.status === 'authenticated' && auth.permissions.includes('courses.assign_teacher');
  const canEnroll = auth.status === 'authenticated' && auth.permissions.includes('enrollments.create');
  const canUpdateEnrollment = auth.status === 'authenticated' && auth.permissions.includes('enrollments.update_status');
  const canIssueCertificate = auth.status === 'authenticated' && auth.permissions.includes('certificates.issue');
  const canRevokeCertificate = auth.status === 'authenticated' && auth.permissions.includes('certificates.revoke');

  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="type-heading-3">Hisobni boshqarish</h2>
        {user.data.deletedAt ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge intent="warning">{statusLabel.DELETED}</Badge>
            <Button
              disabled={restoreMutation.isPending}
              loading={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate(userId)}
            >
              Tiklash
            </Button>
          </div>
        ) : (
          <Button
            className="mt-4"
            disabled={user.data.id === auth.user?.id || deleteMutation.isPending}
            intent="secondary"
            loading={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm('Bu foydalanuvchi arxivlansinmi?')) deleteMutation.mutate(userId);
            }}
          >
            Foydalanuvchini o‘chirish
          </Button>
        )}
        {user.data.id === auth.user?.id && !user.data.deletedAt ? (
          <p className="mt-3 text-body-sm text-text-secondary">O‘zingizning faol hisobingizni o‘chira olmaysiz.</p>
        ) : null}
      </Card>
      <Link className="text-button text-action-secondary-text" to={adminUsersPaths.list}>← Foydalanuvchilarga qaytish</Link>
      <header><p className="text-label-md text-brand-text">Admin boshqaruvi</p><h1 className="type-heading-1 mt-2 break-words">{nameOf(user.data)}</h1><p className="mt-2 break-all text-body-md text-text-secondary">{user.data.email}</p></header>

      <Card><h2 className="type-heading-3">Hisob sozlamalari</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><FormField label="Rol"><Select disabled={user.data.id === auth.user?.id || Boolean(user.data.deletedAt) || roleMutation.isPending} onChange={(event) => { const next = event.target.value as RoleCode; if (window.confirm('Foydalanuvchi rolini o‘zgartirishni tasdiqlaysizmi?')) roleMutation.mutate([next]); }} value={currentRole}><option value="STUDENT">{roleLabel.STUDENT}</option><option value="TEACHER">{roleLabel.TEACHER}</option><option value="ADMIN">{roleLabel.ADMIN}</option></Select></FormField><FormField label="Holat"><Select disabled={user.data.id === auth.user?.id || Boolean(user.data.deletedAt) || statusMutation.isPending} onChange={(event) => { const next = event.target.value as Exclude<UserStatus, 'DELETED'>; if (window.confirm('Foydalanuvchi holatini o‘zgartirishni tasdiqlaysizmi?')) statusMutation.mutate(next); }} value={user.data.status === 'DELETED' ? 'DEACTIVATED' : user.data.status}>{statuses.map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}</Select></FormField></div><p className="mt-4 text-body-sm text-text-secondary">Ro‘yxatdan o‘tgan: {new Intl.DateTimeFormat('uz-Latn-UZ', { dateStyle: 'medium' }).format(new Date(user.data.createdAt))}</p></Card>

      {isTeacher ? <Card><h2 className="type-heading-3">Biriktirilgan kurslar</h2>{assignedCourses.length ? <ul className="mt-4 grid gap-2">{assignedCourses.map((course) => <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-decorative p-3" key={course.id}><span>{course.title}</span><Badge>{course.status}</Badge></li>)}</ul> : <p className="mt-4 text-body-sm text-text-secondary">Hozircha kurs biriktirilmagan.</p>}{canAssignTeacher ? <div className="mt-5 flex flex-wrap items-end gap-3"><FormField className="min-w-[240px]" label="Kurs biriktirish"><Select onChange={(event) => setNewCourseId(event.target.value)} value={newCourseId}><option value="">Kursni tanlang</option>{(courses.data?.items ?? []).filter((course) => course.teacher?.id !== userId).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</Select></FormField><Button disabled={!newCourseId || assign.isPending} loading={assign.isPending} onClick={() => { if (newCourseId) assign.mutate({ courseId: newCourseId, teacherId: userId }, { onSuccess: () => setNewCourseId('') }); }}>Biriktirish</Button></div> : null}</Card> : null}

      {isStudent && student.isError ? <Card role="alert"><p className="text-danger-text">Student ma’lumotlarini yuklab bo‘lmadi.</p><Button className="mt-4" intent="secondary" onClick={() => void student.refetch()}>Qayta urinish</Button></Card> : null}
      {isStudent && !student.isError ? <StudentManagement userId={userId} student={student.data} courses={availableCourses} enroll={enroll} enrollmentStatus={enrollmentStatus} enrollmentAccess={enrollmentAccess} newCourseId={newCourseId} setNewCourseId={setNewCourseId} canEnroll={canEnroll} canUpdateEnrollment={canUpdateEnrollment} canIssueCertificate={canIssueCertificate} canRevokeCertificate={canRevokeCertificate} /> : null}
    </div>
  );
}

function StudentManagement({ userId, student, courses, enroll, enrollmentStatus, enrollmentAccess, newCourseId, setNewCourseId, canEnroll, canUpdateEnrollment, canIssueCertificate, canRevokeCertificate }: { userId: string; student: ReturnType<typeof useAdminStudent>['data']; courses: Array<{ id: string; title: string; status: string }>; enroll: ReturnType<typeof useAdminEnrollStudent>; enrollmentStatus: ReturnType<typeof useAdminEnrollmentStatus>; enrollmentAccess: ReturnType<typeof useAdminEnrollmentAccess>; newCourseId: string; setNewCourseId: (value: string) => void; canEnroll: boolean; canUpdateEnrollment: boolean; canIssueCertificate: boolean; canRevokeCertificate: boolean }) {
  if (student === undefined) return <Card><p role="status">Student ma’lumotlari yuklanmoqda…</p></Card>;
  return <Card><h2 className="type-heading-3">Student kurslari</h2>{canEnroll ? <div className="mt-4 flex flex-wrap items-end gap-3"><FormField className="min-w-[240px]" label="Kursga yozish"><Select onChange={(event) => setNewCourseId(event.target.value)} value={newCourseId}><option value="">Kursni tanlang</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</Select></FormField><Button disabled={!newCourseId || enroll.isPending} loading={enroll.isPending} onClick={() => { if (newCourseId) enroll.mutate({ courseId: newCourseId, studentId: userId }, { onSuccess: () => setNewCourseId('') }); }}>Kursga yozish</Button></div> : null}<div className="mt-6 grid gap-4">{student.courses.length ? student.courses.map((course) => <StudentCourseCard canUpdateEnrollment={canUpdateEnrollment} canIssueCertificate={canIssueCertificate} canRevokeCertificate={canRevokeCertificate} course={course} key={course.enrollmentId} studentId={userId} enrollmentStatus={enrollmentStatus} enrollmentAccess={enrollmentAccess} />) : <p className="text-body-sm text-text-secondary">Student hali kursga yozilmagan.</p>}</div></Card>;
}

function StudentCourseCard({ course, studentId, enrollmentStatus, enrollmentAccess, canUpdateEnrollment, canIssueCertificate, canRevokeCertificate }: { course: AdminStudentCourse; studentId: string; enrollmentStatus: ReturnType<typeof useAdminEnrollmentStatus>; enrollmentAccess: ReturnType<typeof useAdminEnrollmentAccess>; canUpdateEnrollment: boolean; canIssueCertificate: boolean; canRevokeCertificate: boolean }) {
  const [nextStatus, setNextStatus] = useState(course.enrollmentStatus);
  return <article className="rounded-lg border border-border-decorative p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="type-heading-4">{course.course.title}</h3><p className="mt-1 text-body-sm text-text-secondary">Progress: {course.percentage}% · Darslar: {course.completedLessons}/{course.totalEligibleLessons}</p><p className="mt-1 text-caption text-text-muted">Kirish muddati: {new Date(course.accessExpiresAt).toLocaleDateString('uz-Latn-UZ')}</p></div><Badge>{course.enrollmentStatus}</Badge></div>{canUpdateEnrollment ? <div className="mt-4 flex flex-wrap items-end gap-3"><label className="grid gap-1 text-caption text-text-secondary">Enrollment holati<Select onChange={(event) => setNextStatus(event.target.value as typeof nextStatus)} value={nextStatus}><option value="ACTIVE">Faol</option><option value="SUSPENDED">To‘xtatilgan</option><option value="CANCELLED">Bekor qilingan</option><option value="COMPLETED">Tugallangan</option></Select></label><Button disabled={nextStatus === course.enrollmentStatus || enrollmentStatus.isPending} loading={enrollmentStatus.isPending} onClick={() => { if (window.confirm('Enrollment holatini o‘zgartirishni tasdiqlaysizmi?')) enrollmentStatus.mutate({ enrollmentId: course.enrollmentId, studentId, status: nextStatus }); }}>Saqlash</Button><div className="flex flex-wrap gap-2"><span className="self-center text-caption text-text-secondary">Muddatni uzaytirish:</span>{[1, 3, 6, 12].map((months) => <Button key={months} intent="secondary" disabled={enrollmentAccess.isPending} onClick={() => enrollmentAccess.mutate({ enrollmentId: course.enrollmentId, studentId, durationMonths: months })}>{months} oy</Button>)}</div></div> : null}<AdminCertificateCard canIssueCertificate={canIssueCertificate} canRevokeCertificate={canRevokeCertificate} course={course} studentId={studentId} /></article>;
}

function AdminCertificateCard({ course, studentId, canIssueCertificate, canRevokeCertificate }: { course: AdminStudentCourse; studentId: string; canIssueCertificate: boolean; canRevokeCertificate: boolean }) {
  const eligibility = useAdminCertificateEligibility(course.course.id, course.enrollmentId);
  const certificate = useAdminCertificateStatus(course.course.id, course.enrollmentId);
  const issue = useIssueAdminCertificate();
  const revoke = useRevokeAdminCertificate();
  const [password, setPassword] = useState('');
  const [reasonCode, setReasonCode] = useState('ADMINISTRATIVE_ERROR');
  const [reasonNote, setReasonNote] = useState('');
  const eligible = eligibility.data?.eligibility.status === 'ELIGIBLE';
  const status = certificate.data?.status ?? 'NOT_ISSUED';
  const pending = issue.isPending || revoke.isPending;
  const submitIssue = () => { if (!eligibility.data?.eligibility.id || eligibility.data.eligibility.evaluationVersion === null || eligibility.data.completion.completionVersion === null || eligibility.data.completion.completionCurriculumVersion === null || !password || !window.confirm('Sertifikat berishni tasdiqlaysizmi?')) return; issue.mutate({ enrollmentId: course.enrollmentId, eligibility: eligibility.data, password, courseId: course.course.id, studentId }, { onSuccess: () => setPassword('') }); };
  const submitRevoke = () => { const item = certificate.data?.certificate; if (!item || !password || !window.confirm('Sertifikatni bekor qilishni tasdiqlaysizmi?')) return; revoke.mutate({ certificateId: item.certificateId, version: item.version, password, reasonCode, ...(reasonNote ? { reasonNote } : {}), courseId: course.course.id, enrollmentId: course.enrollmentId, studentId }, { onSuccess: () => { setPassword(''); setReasonNote(''); } }); };
  return <div className="mt-5 border-t border-border-decorative pt-4"><h4 className="text-label-md">Sertifikat</h4>{eligibility.isPending || certificate.isPending ? <p className="mt-2 text-body-sm text-text-secondary" role="status">Holat tekshirilmoqda…</p> : eligibility.isError || certificate.isError ? <p className="mt-2 text-body-sm text-danger-text" role="alert">Sertifikat holatini yuklab bo‘lmadi.</p> : <><p className="mt-2 text-body-sm text-text-secondary">Muvofiqlik: {eligible ? 'Muvofiq' : 'Hali muvofiq emas'} · Holat: {status}</p>{status === 'NOT_ISSUED' && eligible && canIssueCertificate ? <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><Input aria-label="Admin paroli" onChange={(event) => setPassword(event.target.value)} placeholder="Admin paroli (qayta tasdiqlash)" type="password" value={password} /><Button disabled={!password || pending} loading={issue.isPending} onClick={submitIssue}>Sertifikat berish</Button></div> : null}{status === 'ISSUED' && certificate.data?.certificate && canRevokeCertificate ? <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><Input aria-label="Admin paroli" onChange={(event) => setPassword(event.target.value)} placeholder="Admin paroli (qayta tasdiqlash)" type="password" value={password} /><Button disabled={!password || pending} intent="secondary" loading={revoke.isPending} onClick={submitRevoke}>Bekor qilish</Button></div> : null}{status === 'ISSUED' && canRevokeCertificate ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><Select aria-label="Bekor qilish sababi" onChange={(event) => setReasonCode(event.target.value)} value={reasonCode}><option value="ADMINISTRATIVE_ERROR">Ma’muriy xato</option><option value="DUPLICATE_ISSUANCE">Takroriy berilgan</option><option value="FRAUD">Firibgarlik</option><option value="POLICY_VIOLATION">Siyosat buzilishi</option><option value="OTHER">Boshqa</option></Select>{reasonCode === 'OTHER' ? <Input aria-label="Bekor qilish izohi" minLength={10} onChange={(event) => setReasonNote(event.target.value)} placeholder="Kamida 10 belgi izoh" value={reasonNote} /> : null}</div> : null}</>}</div>;
}
