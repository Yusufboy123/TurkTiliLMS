import { Prisma, RoleCode } from '@prisma/client';
import { AppError } from '../../utils/app-error.js';
import type { GroupRepository } from './groups.repository.js';
import type {
  CreateGroupInput,
  GroupActor,
  GroupListQuery,
  GroupRecord,
  PaginatedGroups,
  GroupStudentSummary,
} from './groups.types.js';

const admin = (actor: GroupActor) => actor.roles.includes(RoleCode.ADMIN);
const denied = () => new AppError('Bu guruh sizga biriktirilmagan.', 403, 'GROUP_SCOPE_DENIED');
const assertPermission = (actor: GroupActor, permission: string) => {
  if (!actor.permissions.includes(permission)) {
    throw new AppError('Bu amal uchun ruxsat yetarli emas.', 403, 'ACCESS_DENIED');
  }
};
const assertActive = (group: GroupRecord) => {
  if (group.deletedAt) {
    throw new AppError('Arxivlangan guruhni avval tiklash kerak.', 409, 'GROUP_IS_DELETED');
  }
};

export class GroupService {
  constructor(private readonly repository: GroupRepository) {}
  async list(query: GroupListQuery, actor: GroupActor): Promise<PaginatedGroups> {
    const result = await this.repository.list(query, admin(actor) ? undefined : actor.userId);
    return {
      items: result.items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }
  async getById(groupId: string, actor: GroupActor): Promise<GroupRecord> {
    const group = await this.repository.findDetail(groupId);
    if (!group) throw new AppError('Guruh topilmadi.', 404, 'GROUP_NOT_FOUND');
    if (!admin(actor) && group.teacher.id !== actor.userId) throw denied();
    return group;
  }
  async create(input: CreateGroupInput, actor: GroupActor): Promise<GroupRecord> {
    const teacherId = admin(actor) ? input.teacherId : actor.userId;
    if (!teacherId || (!admin(actor) && teacherId !== actor.userId)) throw denied();
    if (!(await this.repository.findEligibleTeacher(teacherId)))
      throw new AppError('Faol o‘qituvchi tanlanmagan.', 422, 'GROUP_TEACHER_INVALID');
    return this.repository.create({ ...input, teacherId, createdById: actor.userId });
  }
  async searchStudents(
    groupId: string,
    search: string,
    pageSize: number,
    actor: GroupActor,
  ): Promise<GroupStudentSummary[]> {
    await this.getById(groupId, actor);
    return this.repository.searchStudents(search, pageSize);
  }
  async addStudent(groupId: string, studentId: string, actor: GroupActor): Promise<GroupRecord> {
    const group = await this.getById(groupId, actor);
    assertActive(group);
    if (!(await this.repository.findEligibleStudent(studentId)))
      throw new AppError('Faol talaba topilmadi.', 404, 'GROUP_STUDENT_NOT_FOUND');
    try {
      await this.repository.addStudent(groupId, studentId);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppError(
          'Talaba bu guruhga allaqachon qo‘shilgan.',
          409,
          'GROUP_STUDENT_ALREADY_MEMBER',
        );
      throw error;
    }
    return this.getById(groupId, actor);
  }
  async removeStudent(groupId: string, studentId: string, actor: GroupActor): Promise<void> {
    const group = await this.getById(groupId, actor);
    assertActive(group);
    if (!(await this.repository.removeStudent(groupId, studentId)))
      throw new AppError('Talaba bu guruh a’zosi emas.', 404, 'GROUP_STUDENT_NOT_MEMBER');
  }

  async delete(groupId: string, actor: GroupActor): Promise<void> {
    assertPermission(actor, 'groups.delete');
    const group = await this.getById(groupId, actor);
    if (group.deletedAt) return;
    if (!(await this.repository.softDelete(groupId))) {
      throw new AppError('Guruh topilmadi.', 404, 'GROUP_NOT_FOUND');
    }
  }

  async restore(groupId: string, actor: GroupActor): Promise<GroupRecord> {
    assertPermission(actor, 'groups.restore');
    const group = await this.getById(groupId, actor);
    if (!group.deletedAt) return group;
    const restored = await this.repository.restore(groupId);
    if (!restored) throw new AppError('Guruh topilmadi.', 404, 'GROUP_NOT_FOUND');
    return restored;
  }
}
