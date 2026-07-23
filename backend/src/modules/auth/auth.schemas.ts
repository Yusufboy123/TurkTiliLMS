import { SessionClientType } from '@prisma/client';
import { z } from 'zod';

export const normalizeEmail = (email: string): string => email.trim().toLocaleLowerCase('en-US');

export const strongPasswordSchema = z
  .string()
  .min(12, 'Yangi parol kamida 12 ta belgidan iborat bo‘lishi kerak.')
  .max(128, 'Yangi parol 128 ta belgidan oshmasligi kerak.')
  .regex(/[a-z]/, 'Yangi parolda kamida bitta kichik harf bo‘lishi kerak.')
  .regex(/[A-Z]/, 'Yangi parolda kamida bitta katta harf bo‘lishi kerak.')
  .regex(/\d/, 'Yangi parolda kamida bitta raqam bo‘lishi kerak.')
  .regex(/[^A-Za-z0-9]/, 'Yangi parolda kamida bitta maxsus belgi bo‘lishi kerak.');

export const loginSchema = z.object({
  email: z.email('Email manzil noto‘g‘ri.').transform(normalizeEmail),
  password: z.string().min(1, 'Parol kiritilishi shart.').max(128),
  clientType: z.nativeEnum(SessionClientType).default(SessionClientType.WEB),
  deviceName: z.string().trim().min(1).max(160).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32, 'Refresh token noto‘g‘ri.').max(512),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Joriy parol kiritilishi shart.').max(128),
    newPassword: strongPasswordSchema,
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    path: ['newPassword'],
    message: 'Yangi parol joriy paroldan farq qilishi kerak.',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
