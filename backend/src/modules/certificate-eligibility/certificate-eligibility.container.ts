import { CertificateEligibilityController } from './certificate-eligibility.controller.js';
import { PrismaCertificateEligibilityRepository } from './certificate-eligibility.repository.js';
import { CertificateEligibilityService } from './certificate-eligibility.service.js';

export const certificateEligibilityRepository = new PrismaCertificateEligibilityRepository();
export const certificateEligibilityService = new CertificateEligibilityService(
  certificateEligibilityRepository,
);
export const certificateEligibilityController = new CertificateEligibilityController(
  certificateEligibilityService,
);
