import type { CourseLevel, RoleCode } from '@prisma/client';

export interface GroupActor {
  userId: string;
  roles: RoleCode[];
  permissions: string[];
}

export interface GroupListQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
  level?: CourseLevel | undefined;
  deleted?: 'exclude' | 'include' | 'only';
}

export interface CreateGroupInput {
  name: string;
  level: CourseLevel;
  teacherId?: string | undefined;
}

export interface GroupStudentSummary {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface GroupRecord {
  id: string;
  name: string;
  level: CourseLevel;
  teacher: GroupStudentSummary;
  studentCount: number;
  students?: GroupStudentSummary[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedGroups {
  items: GroupRecord[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
