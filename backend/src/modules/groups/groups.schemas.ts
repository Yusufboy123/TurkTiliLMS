import { CourseLevel } from '@prisma/client';
import { z } from 'zod';

const id = z.uuid('Identifikator noto‘g‘ri.');

export const groupIdParamsSchema = z.object({ groupId: id }).strict();
export const groupStudentParamsSchema = z.object({ groupId: id, studentId: id }).strict();
export const listGroupsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    level: z.nativeEnum(CourseLevel).optional(),
  })
  .strict();
export const searchStudentsQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(100),
    pageSize: z.coerce.number().int().min(1).max(20).default(20),
  })
  .strict();
export const createGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    level: z.nativeEnum(CourseLevel),
    teacherId: id.optional(),
  })
  .strict();
export const addGroupStudentSchema = z.object({ studentId: id }).strict();

export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;
export type SearchStudentsQuery = z.infer<typeof searchStudentsQuerySchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
