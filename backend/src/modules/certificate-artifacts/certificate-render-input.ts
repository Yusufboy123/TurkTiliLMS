import { z } from 'zod';
import {
  CERTIFICATE_RENDERER_CONTRACT_VERSION,
  CERTIFICATE_SUPPORTED_LOCALES,
  CERTIFICATE_TEMPLATE_CODE,
  CERTIFICATE_TEMPLATE_VERSION,
} from './certificate-artifact.constants.js';
import {
  invalidRenderInput,
  unsupportedLocale,
  unsupportedTemplate,
} from './certificate-artifact.errors.js';
import type { CertificateRenderInput } from './certificate-artifact.types.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const CERTIFICATE_NUMBER_PATTERN = /^TTL-\d{4}-\d{10}$/u;
const UNICODE_FORMAT_CHARACTER_PATTERN = /\p{Cf}/u;

function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      UNICODE_FORMAT_CHARACTER_PATTERN.test(character) ||
      (codePoint !== undefined && (codePoint < 32 || codePoint === 127))
    );
  });
}

function normalizedText(maximumLength: number) {
  return z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(1)
        .max(maximumLength)
        .refine((value) => !containsControlCharacter(value), {
          message: 'Control characters are not allowed.',
        }),
    );
}

function isStrictDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

const certificateRenderInputSchema = z
  .object({
    certificateId: z.uuid(),
    certificateNumber: z
      .string()
      .transform((value) => value.normalize('NFC').trim())
      .pipe(z.string().regex(CERTIFICATE_NUMBER_PATTERN)),
    recipientDisplayName: normalizedText(160),
    courseTitle: normalizedText(200),
    completionDate: z.string().refine(isStrictDate, { message: 'Invalid completion date.' }),
    issueDate: z.string().refine(isStrictDate, { message: 'Invalid issue date.' }),
    issuedAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()),
    organizationName: normalizedText(200),
    locale: z.enum(CERTIFICATE_SUPPORTED_LOCALES),
    templateCode: z.literal(CERTIFICATE_TEMPLATE_CODE),
    templateVersionId: z.uuid(),
    templateVersion: z.literal(CERTIFICATE_TEMPLATE_VERSION),
    rendererContractVersion: z.literal(CERTIFICATE_RENDERER_CONTRACT_VERSION),
    signatoryName: normalizedText(160).nullable(),
    signatoryTitle: normalizedText(160).nullable(),
  })
  .strict();

export function normalizeCertificateRenderInput(input: unknown): CertificateRenderInput {
  const result = certificateRenderInputSchema.safeParse(input);
  if (!result.success) {
    const localeIssue = result.error.issues.some((issue) => issue.path[0] === 'locale');
    if (localeIssue) throw unsupportedLocale();

    const templateIssue = result.error.issues.some((issue) =>
      ['templateCode', 'templateVersion', 'rendererContractVersion'].includes(
        String(issue.path[0]),
      ),
    );
    if (templateIssue) throw unsupportedTemplate();

    throw invalidRenderInput(
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  return Object.freeze(result.data);
}
