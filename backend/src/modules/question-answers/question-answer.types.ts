import type { QuestionThreadStatus, RoleCode } from '@prisma/client';

export interface QuestionAnswerActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface QuestionThreadQuery {
  page: number;
  pageSize: number;
  status?: QuestionThreadStatus;
}

export interface QuestionMessageRecord {
  id: string;
  senderId: string;
  senderRole: 'STUDENT' | 'TEACHER';
  body: string;
  createdAt: string;
}

export interface QuestionThreadSummary {
  id: string;
  subject: string | null;
  status: QuestionThreadStatus;
  student: { id: string; name: string };
  teacher: { id: string; name: string };
  course: { id: string; title: string; slug: string };
  lesson: { id: string; title: string } | null;
  latestMessage: QuestionMessageRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionThreadDetail extends QuestionThreadSummary {
  messages: QuestionMessageRecord[];
}

export interface QuestionThreadPage {
  items: QuestionThreadSummary[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
