import type { RoleCode } from '../../auth';

export type GroupLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export interface GroupStudent {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
}
export interface TeacherGroup {
  id: string;
  name: string;
  level: GroupLevel;
  teacher: GroupStudent;
  studentCount: number;
  students?: GroupStudent[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface GroupPage {
  items: TeacherGroup[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
export interface GroupQuery {
  page: number;
  pageSize: number;
  search?: string;
  level?: GroupLevel;
  deleted?: 'exclude' | 'include' | 'only';
}
export interface AuthenticatedTeacher {
  id: string;
  email: string;
  displayName?: string | null;
  roles: RoleCode[];
}
