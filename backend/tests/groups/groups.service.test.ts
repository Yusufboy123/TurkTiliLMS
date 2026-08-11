import { CourseLevel, Prisma, RoleCode } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { GroupService } from '../../src/modules/groups/groups.service.js';
import type { GroupRepository } from '../../src/modules/groups/groups.repository.js';
import type {
  CreateGroupInput,
  GroupActor,
  GroupListQuery,
  GroupRecord,
  GroupStudentSummary,
} from '../../src/modules/groups/groups.types.js';

const teacherId = '019b9e22-e356-713e-be3a-ab43b5b43f8b';
const otherTeacherId = '019b9e22-e356-713e-be3a-ab43b5b43f8c';
const studentId = '019b9e22-e356-713e-be3a-ab43b5b43f8d';
const actor: GroupActor = {
  userId: teacherId,
  roles: [RoleCode.TEACHER],
  permissions: ['groups.read', 'groups.create', 'groups.update_members'],
};
const student: GroupStudentSummary = {
  id: studentId,
  email: 'student@example.com',
  displayName: 'Ali Talaba',
  firstName: 'Ali',
  lastName: 'Talaba',
};
function group(teacher = teacherId, students: GroupStudentSummary[] = []): GroupRecord {
  return {
    id: '019b9e22-e356-713e-be3a-ab43b5b43f8e',
    name: 'A1 guruhi',
    level: CourseLevel.A1,
    teacher: { ...student, id: teacher, email: 'teacher@example.com' },
    studentCount: students.length,
    students,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

class FakeGroupRepository implements GroupRepository {
  groups = [group()];
  members = new Set<string>();
  async list(_query: GroupListQuery, teacherIdValue?: string) {
    const items = this.groups.filter(
      (item) => !teacherIdValue || item.teacher.id === teacherIdValue,
    );
    return { items, total: items.length };
  }
  async findById(id: string) {
    return this.groups.find((item) => item.id === id) ?? null;
  }
  async findDetail(id: string) {
    return this.findById(id);
  }
  async create(input: CreateGroupInput & { teacherId: string; createdById: string }) {
    const item = group(input.teacherId);
    item.name = input.name;
    item.level = input.level;
    this.groups.push(item);
    return item;
  }
  async findEligibleTeacher(id: string) {
    return id === teacherId || id === otherTeacherId;
  }
  async findEligibleStudent(id: string) {
    return id === studentId ? student : null;
  }
  async searchStudents() {
    return [student];
  }
  async addStudent(_groupId: string, id: string) {
    if (this.members.has(id))
      throw new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      });
    this.members.add(id);
  }
  async removeStudent(_groupId: string, id: string) {
    return this.members.delete(id);
  }
  async softDelete(id: string) {
    const item = this.groups.find((candidate) => candidate.id === id);
    if (!item) return null;
    item.deletedAt = new Date();
    return item;
  }
  async restore(id: string) {
    const item = this.groups.find((candidate) => candidate.id === id);
    if (!item) return null;
    item.deletedAt = null;
    return item;
  }
}

describe('GroupService', () => {
  it('creates and scopes groups for a teacher', async () => {
    const repository = new FakeGroupRepository();
    const service = new GroupService(repository);
    const created = await service.create({ name: 'Yangi guruh', level: CourseLevel.B1 }, actor);
    expect(created.teacher.id).toBe(teacherId);
    expect((await service.list({ page: 1, pageSize: 20 }, actor)).items).toHaveLength(2);
  });
  it('searches students, adds once, and removes membership', async () => {
    const repository = new FakeGroupRepository();
    const service = new GroupService(repository);
    expect(
      await service.searchStudents(repository.groups[0]!.id, 'student@example.com', 20, actor),
    ).toEqual([student]);
    await service.addStudent(repository.groups[0]!.id, studentId, actor);
    await expect(
      service.addStudent(repository.groups[0]!.id, studentId, actor),
    ).rejects.toMatchObject({ code: 'GROUP_STUDENT_ALREADY_MEMBER' });
    await service.removeStudent(repository.groups[0]!.id, studentId, actor);
  });
  it('rejects a teacher outside the group scope', async () => {
    const repository = new FakeGroupRepository();
    const service = new GroupService(repository);
    await expect(
      service.getById(repository.groups[0]!.id, { ...actor, userId: otherTeacherId }),
    ).rejects.toMatchObject({ code: 'GROUP_SCOPE_DENIED', statusCode: 403 });
  });
  it('soft-deletes and restores a teacher-owned group', async () => {
    const repository = new FakeGroupRepository();
    const service = new GroupService(repository);
    const groupId = repository.groups[0]!.id;
    await service.delete(groupId, { ...actor, permissions: ['groups.delete'] });
    expect(repository.groups[0]!.deletedAt).toBeInstanceOf(Date);
    const restored = await service.restore(groupId, {
      ...actor,
      permissions: ['groups.restore'],
    });
    expect(restored.deletedAt).toBeNull();
  });
  it('denies a teacher from deleting another teacher group', async () => {
    const repository = new FakeGroupRepository();
    const service = new GroupService(repository);
    await expect(
      service.delete(repository.groups[0]!.id, {
        ...actor,
        userId: otherTeacherId,
        permissions: ['groups.delete'],
      }),
    ).rejects.toMatchObject({ code: 'GROUP_SCOPE_DENIED', statusCode: 403 });
  });
  it('allows an administrator to restore a group', async () => {
    const repository = new FakeGroupRepository();
    const service = new GroupService(repository);
    repository.groups[0]!.deletedAt = new Date();
    const restored = await service.restore(repository.groups[0]!.id, {
      userId: otherTeacherId,
      roles: [RoleCode.ADMIN],
      permissions: ['groups.restore'],
    });
    expect(restored.deletedAt).toBeNull();
  });
});
