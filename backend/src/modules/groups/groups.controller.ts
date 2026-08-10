import type { Request, Response } from 'express';
import { AppError } from '../../utils/app-error.js';
import type { AuthenticatedPrincipal } from '../authorization/authorization.types.js';
import {
  addGroupStudentSchema,
  createGroupSchema,
  groupIdParamsSchema,
  groupStudentParamsSchema,
  listGroupsQuerySchema,
  searchStudentsQuerySchema,
} from './groups.schemas.js';
import type { GroupService } from './groups.service.js';

function principal(request: Request): AuthenticatedPrincipal {
  const value = (request as Request & { auth?: AuthenticatedPrincipal }).auth;
  if (!value)
    throw new AppError(
      'Davom etish uchun tizimga kirish talab qilinadi.',
      401,
      'AUTHENTICATION_REQUIRED',
    );
  return value;
}
const actor = (request: Request) => {
  const p = principal(request);
  return { userId: p.userId, roles: p.roles, permissions: p.permissions };
};

export class GroupController {
  constructor(private readonly service: GroupService) {}
  list = async (req: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      message: 'Guruhlar ro‘yxati olindi.',
      data: await this.service.list(listGroupsQuerySchema.parse(req.query), actor(req)),
    });
  };
  create = async (req: Request, res: Response): Promise<void> => {
    const group = await this.service.create(createGroupSchema.parse(req.body), actor(req));
    res
      .location(`/api/v1/groups/${group.id}`)
      .status(201)
      .json({ success: true, message: 'Guruh yaratildi.', data: group });
  };
  getById = async (req: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      message: 'Guruh ma’lumotlari olindi.',
      data: await this.service.getById(groupIdParamsSchema.parse(req.params).groupId, actor(req)),
    });
  };
  searchStudents = async (req: Request, res: Response) => {
    const { groupId } = groupIdParamsSchema.parse(req.params);
    const query = searchStudentsQuerySchema.parse(req.query);
    res.json({
      success: true,
      message: 'Talabalar qidirildi.',
      data: await this.service.searchStudents(groupId, query.search, query.pageSize, actor(req)),
    });
  };
  addStudent = async (req: Request, res: Response) => {
    const { groupId } = groupIdParamsSchema.parse(req.params);
    const { studentId } = addGroupStudentSchema.parse(req.body);
    res.status(201).json({
      success: true,
      message: 'Talaba guruhga qo‘shildi.',
      data: await this.service.addStudent(groupId, studentId, actor(req)),
    });
  };
  removeStudent = async (req: Request, res: Response) => {
    const { groupId, studentId } = groupStudentParamsSchema.parse(req.params);
    await this.service.removeStudent(groupId, studentId, actor(req));
    res.status(204).send();
  };
}
