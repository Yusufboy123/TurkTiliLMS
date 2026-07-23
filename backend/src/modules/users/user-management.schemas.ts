import { RoleCode, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { normalizeEmail } from '../auth/auth.schemas.js';
import { userSortFields } from './user-management.types.js';

const optionalName = (maximumLength: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} bo‘sh bo‘lmasligi kerak.`)
    .max(maximumLength, `${label} ${maximumLength} ta belgidan oshmasligi kerak.`)
    .refine(
      (value) =>
        [...value].every((character) => {
          const codePoint = character.codePointAt(0);
          return codePoint !== undefined && codePoint > 31 && codePoint !== 127;
        }),
      {
        message: `${label} boshqaruv belgilarini o‘z ichiga olmasligi kerak.`,
      },
    );

const normalizedEmailSchema = z
  .string()
  .trim()
  .pipe(z.email('Email manzil noto‘g‘ri.'))
  .transform(normalizeEmail);

export const userIdParamsSchema = z
  .object({
    userId: z.uuid('Foydalanuvchi identifikatori noto‘g‘ri.'),
  })
  .strict();

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    role: z.nativeEnum(RoleCode).optional(),
    deleted: z.enum(['exclude', 'include', 'only']).default('exclude'),
    sortBy: z.enum(userSortFields).default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const createUserSchema = z
  .object({
    email: normalizedEmailSchema,
    firstName: optionalName(100, 'Ism').optional(),
    lastName: optionalName(100, 'Familiya').optional(),
    displayName: optionalName(160, 'Ko‘rinadigan ism').optional(),
    status: z
      .enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED])
      .default(UserStatus.DEACTIVATED),
    roles: z.array(z.nativeEnum(RoleCode)).min(1).default([RoleCode.STUDENT]),
  })
  .strict()
  .transform((input) => ({ ...input, roles: [...new Set(input.roles)] }));

export const updateUserSchema = z
  .object({
    email: normalizedEmailSchema.optional(),
    firstName: optionalName(100, 'Ism').nullable().optional(),
    lastName: optionalName(100, 'Familiya').nullable().optional(),
    displayName: optionalName(160, 'Ko‘rinadigan ism').nullable().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Yangilash uchun kamida bitta maydon yuborilishi kerak.',
  });

export const updateUserStatusSchema = z
  .object({
    status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DEACTIVATED]),
  })
  .strict();

export const replaceUserRolesSchema = z
  .object({
    roles: z.array(z.nativeEnum(RoleCode)).min(1, 'Kamida bitta rol tanlanishi kerak.'),
  })
  .strict()
  .transform((input) => ({ roles: [...new Set(input.roles)] }));

export const deleteUserSchema = z
  .object({
    confirmation: z.literal(true, {
      error: 'Foydalanuvchini o‘chirish uchun tasdiq talab qilinadi.',
    }),
  })
  .strict();

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ReplaceUserRolesInput = z.infer<typeof replaceUserRolesSchema>;
