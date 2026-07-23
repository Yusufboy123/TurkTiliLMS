import type { RoleCode, UserStatus } from '@prisma/client';

export const userSortFields = [
  'createdAt',
  'updatedAt',
  'email',
  'firstName',
  'lastName',
  'status',
  'lastLoginAt',
] as const;

export type UserSortField = (typeof userSortFields)[number];
export type SortDirection = 'asc' | 'desc';
export type DeletedUserFilter = 'exclude' | 'include' | 'only';

export interface UserManagementRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  hasPassword: boolean;
  roles: RoleCode[];
}

export interface UserDetailRecord extends UserManagementRecord {
  activeSessionCount: number;
}

export interface UserListQuery {
  page: number;
  pageSize: number;
  search?: string | undefined;
  status?: UserStatus | undefined;
  role?: RoleCode | undefined;
  deleted: DeletedUserFilter;
  sortBy: UserSortField;
  sortDirection: SortDirection;
}

export interface PaginatedUsers {
  items: UserManagementRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateUserData {
  email: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  displayName?: string | undefined;
  status: Exclude<UserStatus, 'DELETED'>;
  roles: RoleCode[];
}

export interface UpdateUserData {
  email?: string | undefined;
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  displayName?: string | null | undefined;
}

export interface AuditContext {
  actorUserId: string;
  requestCorrelationId?: string;
  ipHash?: string;
  userAgentSummary?: string;
}

export interface UserStatistics {
  total: number;
  active: number;
  suspended: number;
  deactivated: number;
  deleted: number;
  emailVerified: number;
  emailUnverified: number;
  createdLast30Days: number;
  byRole: Record<RoleCode, number>;
}

export interface UserManagementActor {
  userId: string;
  permissions: string[];
}
