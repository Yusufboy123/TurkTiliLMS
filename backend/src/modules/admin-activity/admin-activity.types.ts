import type { RoleCode } from '@prisma/client';

export interface AdminActivityActor {
  readonly userId: string;
  readonly roles: readonly RoleCode[];
  readonly permissions: readonly string[];
}

export interface AdminActivityQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly actorUserId?: string | undefined;
  readonly action?: string | undefined;
  readonly entityType?: string | undefined;
  readonly from?: Date | undefined;
  readonly to?: Date | undefined;
}

export interface AdminActivityRecord {
  readonly id: string;
  readonly actor: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  } | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly summary: string;
  readonly createdAt: string;
}

export interface AdminActivityPage {
  readonly items: AdminActivityRecord[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
