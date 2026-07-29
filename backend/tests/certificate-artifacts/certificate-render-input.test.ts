import { normalizeCertificateRenderInput } from '../../src/modules/certificate-artifacts/certificate-render-input.js';
import { renderInput } from '../helpers/certificate-artifact-fakes.js';

describe('certificate render input', () => {
  it('normalizes Unicode and whitespace and returns an immutable value', () => {
    const normalized = normalizeCertificateRenderInput({
      ...renderInput(),
      recipientDisplayName: '  O\u0308zbek   O‘quvchi \n',
      courseTitle: '  Türkçe\tA1  ',
    });

    expect(normalized.recipientDisplayName).toBe('Özbek O‘quvchi');
    expect(normalized.courseTitle).toBe('Türkçe A1');
    expect(Object.isFrozen(normalized)).toBe(true);
  });

  it.each([
    ['missing required field', { ...renderInput(), certificateNumber: undefined }],
    ['invalid certificate number', { ...renderInput(), certificateNumber: 'INVALID' }],
    ['invalid completion date', { ...renderInput(), completionDate: '2026-02-30' }],
    ['invalid issued timestamp', { ...renderInput(), issuedAt: '2026-07-28' }],
    ['overlong recipient', { ...renderInput(), recipientDisplayName: 'a'.repeat(161) }],
    ['control character', { ...renderInput(), courseTitle: 'A1\u0000' }],
  ])('rejects %s', (_label, value) => {
    expect(() => normalizeCertificateRenderInput(value)).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_RENDER_INPUT_INVALID' }),
    );
  });

  it('rejects unsupported locales with a stable error', () => {
    expect(() => normalizeCertificateRenderInput({ ...renderInput(), locale: 'tr' })).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_RENDER_LOCALE_UNSUPPORTED' }),
    );
  });

  it.each([
    ['templateCode', 'UNAPPROVED'],
    ['templateVersion', 2],
    ['rendererContractVersion', 'certificate-pdf-v2'],
  ])('rejects unsupported %s', (field, value) => {
    expect(() => normalizeCertificateRenderInput({ ...renderInput(), [field]: value })).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_TEMPLATE_UNSUPPORTED' }),
    );
  });

  it('rejects arbitrary layout, font, storage, markup, and path fields', () => {
    expect(() =>
      normalizeCertificateRenderInput({
        ...renderInput(),
        html: '<script>alert(1)</script>',
        fontPath: '../font.ttf',
        storagePath: '../certificate.pdf',
        x: 100,
      }),
    ).toThrow(expect.objectContaining({ code: 'CERTIFICATE_RENDER_INPUT_INVALID' }));
  });

  it.each([
    ['bidirectional override', 'Turk tili \u202eA1'],
    ['zero-width character', 'Turk\u200b tili'],
  ])('rejects unsafe Unicode %s', (_label, courseTitle) => {
    expect(() => normalizeCertificateRenderInput({ ...renderInput(), courseTitle })).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_RENDER_INPUT_INVALID' }),
    );
  });
});
