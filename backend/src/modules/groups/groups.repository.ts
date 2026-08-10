import { RoleCode, UserStatus, type Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import type {
  CreateGroupInput,
  GroupListQuery,
  GroupRecord,
  GroupStudentSummary,
} from './groups.types.js';

const personSelect = {
  id: true,
  email: true,
  displayName: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;
const groupSelect = {
  id: true,
  name: true,
  level: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: personSelect },
  _count: { select: { memberships: true } },
} satisfies Prisma.GroupSelect;
const detailSelect = {
  ...groupSelect,
  memberships: {
    orderBy: [{ joinedAt: 'asc' as const }, { studentId: 'asc' as const }],
    select: { student: { select: personSelect } },
  },
} satisfies Prisma.GroupSelect;

type GroupPayload = Prisma.GroupGetPayload<{ select: typeof groupSelect }>;
type DetailPayload = Prisma.GroupGetPayload<{ select: typeof detailSelect }>;

function mapGroup(group: GroupPayload): GroupRecord {
  return { ...group, studentCount: group._count.memberships };
}
function mapDetail(group: DetailPayload): GroupRecord {
  return { ...mapGroup(group), students: group.memberships.map(({ student }) => student) };
}

export interface GroupRepository {
  list(query: GroupListQuery, teacherId?: string): Promise<{ items: GroupRecord[]; total: number }>;
  findById(groupId: string): Promise<GroupRecord | null>;
  findDetail(groupId: string): Promise<GroupRecord | null>;
  create(
    input: CreateGroupInput & { teacherId: string; createdById: string },
  ): Promise<GroupRecord>;
  findEligibleTeacher(userId: string): Promise<boolean>;
  findEligibleStudent(userId: string): Promise<GroupStudentSummary | null>;
  searchStudents(search: string, pageSize: number): Promise<GroupStudentSummary[]>;
  addStudent(groupId: string, studentId: string): Promise<void>;
  removeStudent(groupId: string, studentId: string): Promise<boolean>;
}

function eligibleRole(code: RoleCode, now = new Date()) {
  return { some: { role: { code }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } };
}

export class PrismaGroupRepository implements GroupRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async list(query: GroupListQuery, teacherId?: string) {
    const where: Prisma.GroupWhereInput = {
      ...(teacherId ? { teacherId } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.client.$transaction([
      this.client.group.findMany({
        where,
        select: groupSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.client.group.count({ where }),
    ]);
    return { items: items.map(mapGroup), total };
  }
  async findById(groupId: string) {
    const group = await this.client.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });
    return group ? mapGroup(group) : null;
  }
  async findDetail(groupId: string) {
    const group = await this.client.group.findUnique({
      where: { id: groupId },
      select: detailSelect,
    });
    return group ? mapDetail(group) : null;
  }
  async create(input: CreateGroupInput & { teacherId: string; createdById: string }) {
    const group = await this.client.group.create({ data: input, select: groupSelect });
    return mapGroup(group);
  }
  async findEligibleTeacher(userId: string) {
    const user = await this.client.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: eligibleRole(RoleCode.TEACHER),
      },
      select: { id: true },
    });
    return Boolean(user);
  }
  async findEligibleStudent(userId: string) {
    return this.client.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: eligibleRole(RoleCode.STUDENT),
      },
      select: personSelect,
    });
  }
  async searchStudents(search: string, pageSize: number) {
    return this.client.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: eligibleRole(RoleCode.STUDENT),
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: personSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: pageSize,
    });
  }
  async addStudent(groupId: string, studentId: string) {
    await this.client.groupStudent.create({ data: { groupId, studentId } });
  }
  async removeStudent(groupId: string, studentId: string) {
    const result = await this.client.groupStudent.deleteMany({ where: { groupId, studentId } });
    return result.count > 0;
  }
}
