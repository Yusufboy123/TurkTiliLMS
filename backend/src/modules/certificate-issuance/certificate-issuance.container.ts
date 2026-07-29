import { certificateArtifactService } from '../certificate-artifacts/index.js';
import { stepUpAuthenticationService } from '../step-up-authentication/step-up-authentication.container.js';
import { CertificateIssuanceController } from './certificate-issuance.controller.js';
import { PrismaCertificateIssuanceRepository } from './certificate-issuance.repository.js';
import { CertificateIssuanceService } from './certificate-issuance.service.js';

export const certificateIssuanceService = new CertificateIssuanceService(
  new PrismaCertificateIssuanceRepository(),
  certificateArtifactService,
  stepUpAuthenticationService,
);

export const certificateIssuanceController = new CertificateIssuanceController(
  certificateIssuanceService,
);
