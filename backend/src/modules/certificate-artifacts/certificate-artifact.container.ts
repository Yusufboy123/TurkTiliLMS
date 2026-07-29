import { fileURLToPath } from 'node:url';
import { environment } from '../../config/environment.js';
import { PackageNotoSansFontSource } from './certificate-font-source.js';
import { PrismaCertificateArtifactRepository } from './certificate-artifact.repository.js';
import { PdfKitCertificateRenderer } from './certificate-artifact.renderer.js';
import { CertificateArtifactService } from './certificate-artifact.service.js';
import { resolveCertificateArtifactStorageRoot } from './certificate-artifact.storage-root.js';
import { LocalCertificateArtifactStorage } from './certificate-artifact.storage.js';

const projectRoot = fileURLToPath(new URL('../../../..', import.meta.url));
const certificateStorageRoot = resolveCertificateArtifactStorageRoot(
  projectRoot,
  environment.CERTIFICATE_ARTIFACT_STORAGE_ROOT,
  environment.MEDIA_STORAGE_ROOT,
);

export const localCertificateArtifactStorage = new LocalCertificateArtifactStorage(
  certificateStorageRoot,
  environment.CERTIFICATE_PDF_MAX_BYTES,
);
export const certificateRenderer = new PdfKitCertificateRenderer(
  new PackageNotoSansFontSource(),
  environment.CERTIFICATE_PDF_RENDER_TIMEOUT_MS,
  environment.CERTIFICATE_PDF_MAX_BYTES,
);
export const certificateArtifactService = new CertificateArtifactService(
  new PrismaCertificateArtifactRepository(),
  certificateRenderer,
  localCertificateArtifactStorage,
  environment.CERTIFICATE_PDF_MAX_BYTES,
);
