export const CERTIFICATE_PDF_MIME_TYPE = 'application/pdf';
export const CERTIFICATE_PDF_MAX_CONTRACT_BYTES = 10_485_760;
export const PDFKIT_PACKAGE_VERSION = '0.19.1';
export const CERTIFICATE_RENDERER_IDENTIFIER = 'pdfkit-direct-certificate-renderer';
export const CERTIFICATE_RENDERER_VERSION = `pdfkit-${PDFKIT_PACKAGE_VERSION}-layout-v1`;
export const CERTIFICATE_RENDERER_CONTRACT_VERSION = 'certificate-pdf-v1';
export const CERTIFICATE_TEMPLATE_CODE = 'STANDARD_COURSE_COMPLETION';
export const CERTIFICATE_TEMPLATE_VERSION = 1;
export const CERTIFICATE_SUPPORTED_LOCALES = ['uz-Latn'] as const;

export const NOTO_SANS_PACKAGE_VERSION = '0.4.2';
export const NOTO_SANS_FAMILY = 'Noto Sans';
export const NOTO_SANS_LICENSE_IDENTIFIER = 'OFL-1.1';
export const NOTO_SANS_ASSET_ID = 'npm:@expo-google-fonts/noto-sans@0.4.2:400Regular+700Bold';

export const CERTIFICATE_STORAGE_NAMESPACE = 'certificates';
export const CERTIFICATE_STORAGE_PROVIDER = 'LOCAL' as const;
