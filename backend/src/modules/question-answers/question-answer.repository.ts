import { CourseEnrollmentStatus, QuestionThreadStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type { CreateQuestionInput, QuestionMessageInput, ThreadStatusInput } from './question-answer.schemas.js';
import type {
  QuestionMessageRecord,
  QuestionThreadDetail,
  QuestionThreadQuery,
  QuestionThreadSummary,
} from './question-answer.types.js';

const personSelect = { id: true, firstName: true, lastName: true, displayName: true } satisfies Prisma.UserSelect;
const threadSelect = {
  id: true,
  subject: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  student: { select: personSelect },
  teacher: { select: personSelect },
  course: { select: { id: true, title: true, slug: true } },
  lesson: { select: { id: true, title: true } },
} satisfies Prisma.QuestionThreadSelect;
const messageSelect = { id: true, senderId: true, body: true, createdAt: true } satisfies Prisma.QuestionMessageSelect;

type Person = { id: string; firstName: string | null; lastName: string | null; displayName: string | null };
type ThreadPayload = Prisma.QuestionThreadGetPayload<{ select: typeof threadSelect }>;
type MessagePayload = Prisma.QuestionMessageGetPayload<{ select: typeof messageSelect }>;

function personName(person: Person): string {
  return person.displayName?.trim() || [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Foydalanuvchi';
}

function messageRecord(message: MessagePayload, studentId: string, teacherId: string): QuestionMessageRecord {
  return {
    id: message.id,
    senderId: message.senderId,
    senderRole: message.senderId === studentId ? 'STUDENT' : message.senderId === teacherId ? 'TEACHER' : 'STUDENT',
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

function summary(thread: ThreadPayload, latestMessage: QuestionMessageRecord | null): QuestionThreadSummary {
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    student: { id: thread.student.id, name: personName(thread.student) },
    teacher: { id: thread.teacher.id, name: personName(thread.teacher) },
    course: thread.course,
    lesson: thread.lesson,
    latestMessage,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  };
}

const activeEnrollment = (studentId: string, courseId: string, now: Date): Prisma.CourseEnrollmentWhereInput => ({
  studentId,
  courseId,
  status: { in: [CourseEnrollmentStatus.ACTIVE, CourseEnrollmentStatus.COMPLETED] },
  accessStartsAt: { lte: now },
  accessExpiresAt: { gt: now },
});

export interface QuestionAnswerRepository {
  listForStudent(studentId: string, query: QuestionThreadQuery): Promise<{ items: QuestionThreadSummary[]; total: number }>;
  listForTeacher(teacherId: string, query: QuestionThreadQuery): Promise<{ items: QuestionThreadSummary[]; total: number }>;
  findForStudent(studentId: string, threadId: string): Promise<QuestionThreadDetail | null>;
  findForTeacher(teacherId: string, threadId: string): Promise<QuestionThreadDetail | null>;
  createStudentQuestion(studentId: string, input: CreateQuestionInput): Promise<QuestionThreadDetail | null>;
  addStudentMessage(studentId: string, threadId: string, input: QuestionMessageInput): Promise<QuestionThreadDetail | null>;
  addTeacherMessage(teacherId: string, threadId: string, input: QuestionMessageInput): Promise<QuestionThreadDetail | null>;
  setTeacherStatus(teacherId: string, threadId: string, input: ThreadStatusInput): Promise<QuestionThreadDetail | null>;
}

export class PrismaQuestionAnswerRepository implements QuestionAnswerRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  private async list(where: Prisma.QuestionThreadWhereInput, query: QuestionThreadQuery) {
    const scoped = { ...where, ...(query.status ? { status: query.status } : {}) } satisfies Prisma.QuestionThreadWhereInput;
    const [rows, total] = await this.client.$transaction([
      this.client.questionThread.findMany({
        where: scoped,
        select: threadSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.questionThread.count({ where: scoped }),
    ]);
    const items = await Promise.all(rows.map(async (row) => {
      const latest = await this.client.questionMessage.findFirst({ where: { threadId: row.id }, select: messageSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      return summary(row, latest ? messageRecord(latest, row.student.id, row.teacher.id) : null);
    }));
    return { items, total };
  }

  listForStudent(studentId: string, query: QuestionThreadQuery) {
    return this.list({ studentId }, query);
  }

  listForTeacher(teacherId: string, query: QuestionThreadQuery) {
    return this.list({ teacherId, course: { teacherId } }, query);
  }

  private async detail(where: Prisma.QuestionThreadWhereInput): Promise<QuestionThreadDetail | null> {
    const thread = await this.client.questionThread.findFirst({ where, select: threadSelect });
    if (!thread) return null;
    const messages = await this.client.questionMessage.findMany({ where: { threadId: thread.id }, select: messageSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 200 });
    return { ...summary(thread, messages.length ? messageRecord(messages[messages.length - 1]!, thread.student.id, thread.teacher.id) : null), messages: messages.map((message) => messageRecord(message, thread.student.id, thread.teacher.id)) };
  }

  findForStudent(studentId: string, threadId: string) {
    return this.detail({ id: threadId, studentId });
  }

  findForTeacher(teacherId: string, threadId: string) {
    return this.detail({ id: threadId, teacherId, course: { teacherId } });
  }

  async createStudentQuestion(studentId: string, input: CreateQuestionInput): Promise<QuestionThreadDetail | null> {
    const now = new Date();
    const created = await this.client.$transaction(async (tx) => {
      const course = await tx.course.findFirst({
        where: { id: input.courseId, deletedAt: null, teacherId: { not: null }, enrollments: { some: activeEnrollment(studentId, input.courseId, now) } },
        select: { id: true, teacherId: true },
      });
      if (!course?.teacherId) return null;
      if (input.lessonId) {
        const lesson = await tx.lesson.findFirst({ where: { id: input.lessonId, courseId: input.courseId, status: 'PUBLISHED', deletedAt: null, section: { isPublished: true, deletedAt: null } }, select: { id: true } });
        if (!lesson) return null;
      }
      const thread = await tx.questionThread.create({ data: { studentId, teacherId: course.teacherId, courseId: input.courseId, ...(input.lessonId ? { lessonId: input.lessonId } : {}), ...(input.subject ? { subject: input.subject } : {}), status: QuestionThreadStatus.OPEN }, select: { id: true, teacherId: true } });
      const message = await tx.questionMessage.create({ data: { threadId: thread.id, senderId: studentId, body: input.body }, select: { id: true } });
      await tx.notification.create({ data: { userId: thread.teacherId, type: 'QNA_QUESTION_CREATED', title: 'Yangi talaba savoli', message: 'Sizga yangi talaba savoli yuborildi.', targetUrl: `/teacher/questions/${thread.id}`, dedupeKey: `qna:message:${message.id}` } });
      return thread.id;
    });
    return created ? this.findForStudent(studentId, created) : null;
  }

  async addStudentMessage(studentId: string, threadId: string, input: QuestionMessageInput): Promise<QuestionThreadDetail | null> {
    const now = new Date();
    const updated = await this.client.$transaction(async (tx) => {
      const thread = await tx.questionThread.findFirst({ where: { id: threadId, studentId }, select: { id: true, teacherId: true, courseId: true, status: true } });
      if (!thread || thread.status === QuestionThreadStatus.CLOSED) return null;
      const enrollment = await tx.courseEnrollment.findFirst({ where: activeEnrollment(studentId, thread.courseId, now), select: { id: true } });
      if (!enrollment) return null;
      const message = await tx.questionMessage.create({ data: { threadId, senderId: studentId, body: input.body }, select: { id: true } });
      await tx.questionThread.update({ where: { id: threadId }, data: { status: QuestionThreadStatus.OPEN } });
      await tx.notification.create({ data: { userId: thread.teacherId, type: 'QNA_QUESTION_CREATED', title: 'Yangi talaba savoli', message: 'Talaba savolga qo‘shimcha xabar yubordi.', targetUrl: `/teacher/questions/${threadId}`, dedupeKey: `qna:message:${message.id}` } });
      return threadId;
    });
    return updated ? this.findForStudent(studentId, updated) : null;
  }

  async addTeacherMessage(teacherId: string, threadId: string, input: QuestionMessageInput): Promise<QuestionThreadDetail | null> {
    const updated = await this.client.$transaction(async (tx) => {
      const thread = await tx.questionThread.findFirst({ where: { id: threadId, teacherId, status: { not: QuestionThreadStatus.CLOSED }, course: { teacherId } }, select: { id: true, studentId: true } });
      if (!thread) return null;
      const message = await tx.questionMessage.create({ data: { threadId, senderId: teacherId, body: input.body }, select: { id: true } });
      await tx.questionThread.update({ where: { id: threadId }, data: { status: QuestionThreadStatus.ANSWERED } });
      await tx.notification.create({ data: { userId: thread.studentId, type: 'QNA_TEACHER_REPLIED', title: 'O‘qituvchingiz savolingizga javob berdi', message: 'Savolingizga yangi javob keldi.', targetUrl: `/app/questions/${threadId}`, dedupeKey: `qna:message:${message.id}` } });
      return threadId;
    });
    return updated ? this.findForTeacher(teacherId, updated) : null;
  }

  async setTeacherStatus(teacherId: string, threadId: string, input: ThreadStatusInput): Promise<QuestionThreadDetail | null> {
    const thread = await this.client.questionThread.findFirst({ where: { id: threadId, teacherId, course: { teacherId } }, select: { id: true } });
    if (!thread) return null;
    await this.client.questionThread.update({ where: { id: threadId }, data: { status: input.status === 'CLOSED' ? QuestionThreadStatus.CLOSED : QuestionThreadStatus.OPEN } });
    return this.findForTeacher(teacherId, threadId);
  }
}
